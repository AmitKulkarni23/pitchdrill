// Full round lifecycle through the dev server's fetch handler: DynamoDB Local + fake IVS + a mocked clock.
import { afterAll, beforeAll, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { fake, installFakeIvs } from "./fakeIvs";

installFakeIvs();
process.env.RECORDINGS_CDN_DOMAIN_ENV = "cdn.example";
const { fetchHandler } = await import("../src/dev/server");
const { tick } = await import("../src/lib/lifecycle");
const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { slotsForDate } = await import("../src/lib/slots");
const { getRound } = await import("../src/lib/rounds");

const SLOT = slotsForDate("2097-03-03")[4]!;
const T = Date.parse(SLOT);
const MIN = 60_000;
const voter = () => crypto.randomUUID();

async function api(method: string, path: string, body?: unknown, ticket?: string) {
  const res = await fetchHandler(
    new Request(`http://dev${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: ticket ? { "x-ticket": ticket } : {} }),
  );
  return { status: res.status, body: (await res.json()) as any };
}
const at = async (ms: number) => {
  setSystemTime(new Date(ms));
  await tick(ms);
};

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("round lifecycle", () => {
  const t: Record<string, { ticket: string; booking: any }> = {};
  let r1 = "";
  let r2 = "";

  beforeAll(async () => {
    await createLocalTable();
    fake.reset();
    spyOn(SecretsManagerClient.prototype, "send").mockRejectedValue(new Error("no key in tests") as never);
    setSystemTime(new Date(T - 86_400_000));
    for (const [h, role] of [["amit", "seller"], ["riya", "buyer"], ["sam", "seller"], ["jo_1", "buyer"], ["kai", "seller"]] as const) {
      const res = await api("POST", "/bookings", { slotId: SLOT, handle: h, role });
      expect(res.status).toBe(201);
      t[h] = res.body;
    }
    r1 = t.riya!.booking.roundId;
    r2 = t.jo_1!.booking.roundId;
    // A buyer who booked at the same instant as kai and missed the pairing (the race the T-5m sweep fixes).
    const bookingId = crypto.randomUUID();
    await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `SLOT#${SLOT}`, SK: `BOOKING#${bookingId}`, slotId: SLOT, bookingId, handle: "late", role: "buyer", status: "waiting", createdAt: new Date(T - 86_400_000).toISOString() } }));
    await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `SLOT#${SLOT}`, SK: `WAIT#buyer#2097-01-01T00:00:00.000Z#${bookingId}`, bookingId, handle: "late" } }));
    await db.send(new UpdateCommand({ TableName: TABLE, Key: { PK: `SLOT#${SLOT}`, SK: "STATS" }, UpdateExpression: "ADD waitingBuyers :one, buyers :one", ExpressionAttributeValues: { ":one": 1 } }));
  });
  afterAll(() => setSystemTime());

  test("GET /slots reflects the bookings", async () => {
    const { body } = await api("GET", "/slots");
    expect(body.slots.find((s: any) => s.slotId === SLOT)).toMatchObject({ sellers: 3, buyers: 3, waitingSellers: 1, waitingBuyers: 1, rounds: 2 });
  });

  test("T-5m: sweep pairs leftovers and falls back to canned briefs; T-2m: opens every round once", async () => {
    await at(T - 5 * MIN);
    const kai = await api("GET", "/ticket", undefined, t.kai!.ticket);
    expect(kai.body.booking).toMatchObject({ status: "paired", opponentHandle: "late" });
    expect(await getRound(r1)).toMatchObject({ status: "paired", briefs: { source: "fallback" } });
    expect(fake.creates).toBe(0); // no stage (and no IVS billing) until T-2m
    await at(T - 2 * MIN);
    await at(T - 2 * MIN + 1000); // a second tick must not create more stages
    expect(fake.creates).toBe(3);
    const round = await getRound(r1);
    expect(round).toMatchObject({ status: "ready" });
    expect(fake.stages.has(round!.stageArn!)).toBe(true);
    const products = await Promise.all([r1, r2, kai.body.booking.roundId].map(async (id) => (await getRound(id))!.briefs!.product.name));
    expect(new Set(products).size).toBe(3); // rounds in one slot never share a canned product
  });

  test("public round never exposes briefs or ARNs; live list shows ready rounds", async () => {
    const { body } = await api("GET", `/rounds/${r1}`);
    expect(body.round).toMatchObject({ roundId: r1, status: "ready", sellerHandle: "amit", buyerHandle: "riya" });
    expect(JSON.stringify(body)).not.toMatch(/briefs|stage\/|room\/|BookingId/); // ready: nothing revealed yet
    setSystemTime(new Date(T - MIN));
    expect((await api("GET", "/rounds/live")).body.rounds).toHaveLength(3);
    expect((await api("GET", "/rounds/not-a-uuid")).status).toBe(404);
  });

  test("briefs: own side only, from T-5m", async () => {
    setSystemTime(new Date(T - 6 * MIN));
    expect((await api("GET", `/rounds/${r1}/brief`, undefined, t.amit!.ticket)).body.error.code).toBe("brief_not_yet");
    setSystemTime(new Date(T - 5 * MIN));
    const seller = await api("GET", `/rounds/${r1}/brief`, undefined, t.amit!.ticket);
    const buyer = await api("GET", `/rounds/${r1}/brief`, undefined, t.riya!.ticket);
    const round = await getRound(r1);
    expect(seller.body).toEqual({ role: "seller", product: round!.briefs!.product, brief: round!.briefs!.seller });
    expect(buyer.body.brief).toEqual(round!.briefs!.buyer);
    expect((await api("GET", `/rounds/${r1}/brief`, undefined, t.sam!.ticket)).status).toBe(403);
    expect((await api("GET", `/rounds/${r1}/brief`)).status).toBe(401);
  });

  test("join, watch and chat tokens", async () => {
    const join = await api("POST", `/rounds/${r1}/join`, {}, t.amit!.ticket);
    expect(join.body).toMatchObject({ role: "seller", stageToken: `stage:${t.amit!.booking.bookingId}:pub`, chatToken: { token: `chat:${t.amit!.booking.bookingId}:recv` } });
    expect((await api("POST", `/rounds/${r1}/join`, {}, t.sam!.ticket)).body.error.code).toBe("not_your_round");
    const v = voter();
    expect((await api("POST", `/rounds/${r1}/watch`, { voterId: v })).body.stageToken).toBe(`stage:viewer-${v}:sub`);
    expect((await api("POST", `/rounds/${r1}/watch`, { voterId: "x" })).body.error.code).toBe("bad_voter");
    expect((await api("POST", `/rounds/${r1}/chat-token`, { voterId: v, nickname: "  Big Fan " })).body.token).toBe(`chat:viewer-${v}:send`);
    expect((await api("POST", `/rounds/${r1}/chat-token`, { voterId: v, nickname: "AMIT" })).body.error.code).toBe("nickname_taken");
    expect((await api("POST", `/rounds/${r1}/chat-token`, { voterId: v, nickname: "<script>" })).body.error.code).toBe("bad_nickname");
  });

  test("T: both publishing → live; missing side → cancelled after the grace minute", async () => {
    const [m1, m2] = [await getRound(r1), await getRound(r2)];
    fake.publishing.set(m1!.stageArn!, [m1!.sellerBookingId, m1!.buyerBookingId]);
    fake.publishing.set(m2!.stageArn!, [m2!.sellerBookingId]);
    await at(T - 1000); // the tick just before T waits for T and starts on the dot
    expect((await getRound(r1))!).toMatchObject({ status: "live", startedAt: SLOT });
    await at(T + 2000);
    expect((await getRound(r2))!.status).toBe("ready");
    expect(fake.events.some((e) => e.name === "round_started")).toBe(true);
    expect((await api("POST", `/rounds/${r1}/votes`, { voterId: voter(), vote: "sold" })).body.error.code).toBe("voting_closed");
    const live = (await api("GET", `/rounds/${r1}`)).body.round;
    expect(live.product.name).toBeString();
    expect(live.briefs.seller).toEqual((await getRound(r1))!.briefs!.seller);
    expect(live.briefs.buyer).toBeUndefined(); // persona stays hidden until the buzzer
    // This tick also waits out r1's buzzer (T+2m, within END_LEAD); the clock is mocked, timers aren't, so skip the wait.
    const wait = globalThis.setTimeout;
    const instant = spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => wait(fn, 0)) as never);
    await at(T + MIN);
    instant.mockRestore();
    expect((await getRound(r1))!.status).toBe("ended");
    const cancelled = await getRound(r2);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelReason: "no_show" });
    expect(fake.stages.has(cancelled!.stageArn!)).toBe(false);
  });

  test("buzzer at startedAt+2m ends the round; votes once per voter with a live tally", async () => {
    await at(T + 2000 + 2 * MIN);
    const ended = await getRound(r1); // ended by the T+1m tick, at the buzzer
    expect(ended).toMatchObject({ status: "ended" });
    expect(fake.stages.has(ended!.stageArn!)).toBe(false);
    expect(fake.events.some((e) => e.name === "buzzer")).toBe(true);
    expect((await api("GET", `/rounds/${r1}`)).body.round.briefs.buyer).toEqual(ended!.briefs!.buyer);
    const v = voter();
    expect((await api("POST", `/rounds/${r1}/votes`, { voterId: v, vote: "sold" })).body).toEqual({ votesSold: 1, votesNotSold: 0 });
    const again = await api("POST", `/rounds/${r1}/votes`, { voterId: v, vote: "not_sold" });
    expect(again.body.error).toMatchObject({ code: "already_voted", votesSold: 1 });
    expect(fake.events.at(-1)).toMatchObject({ name: "tally", attrs: { sold: "1", notSold: "0" } });
    expect((await api("POST", `/rounds/${r1}/votes`, { voterId: voter(), vote: "maybe" })).status).toBe(400);
  });

  test("comments and reports", async () => {
    const v = voter();
    const c = await api("POST", `/rounds/${r1}/comments`, { voterId: v, nickname: "fan", text: " Great close! " });
    expect(c.status).toBe(201);
    expect(c.body.comment.text).toBe("Great close!");
    expect((await api("POST", `/rounds/${r1}/comments`, { voterId: v, nickname: "fan", text: "x".repeat(501) })).status).toBe(400);
    const list = await api("GET", `/rounds/${r1}/comments`);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].voterId).toBeUndefined();
    // Live chat goes through the review handler into the same comment list, in time order.
    const { handler: review } = await import("../src/handlers/reviewChatMessage");
    const res = await review({ Content: "Live!", MessageId: "m1", Sender: { UserId: `viewer-${v}`, Attributes: { nickname: "fan", roundId: r1 } } }, {} as never);
    expect(res).toEqual({ ReviewResult: "ALLOW" });
    expect((await api("GET", `/rounds/${r1}/comments`)).body.comments.map((x: { text: string }) => x.text)).toEqual(["Great close!", "Live!"]);
    expect((await api("GET", `/rounds/${r1}/comments?cursor=garbage`)).body.error.code).toBe("bad_cursor");
    expect((await api("POST", `/rounds/${r1}/reports`, { voterId: v, reason: "spam" })).status).toBe(201);
    expect((await api("POST", `/rounds/${r1}/reports`, { voterId: v, reason: "spam" })).body.error.code).toBe("already_reported");
    expect((await api("GET", "/admin/reports")).body.reports[0]).toMatchObject({ roundId: r1, reason: "spam", round: { status: "ended" } });
  });

  test("recording lands → replay feed; T+15m closes the room; hide removes it", async () => {
    fake.recordings.add(`prefix/${r1}`);
    await at(T + 10 * MIN);
    const feed = await api("GET", "/replays");
    expect(feed.body.replays[0]).toMatchObject({ roundId: r1, replayUrl: `https://cdn.example/prefix/${r1}/media/hls/multivariant.m3u8` });
    await at(T + 15 * MIN);
    const closed = await getRound(r1);
    expect(closed!.status).toBe("closed");
    expect(fake.rooms.has(closed!.chatRoomArn!)).toBe(false);
    expect((await api("POST", `/admin/rounds/${r1}/end`)).body.error.code).toBe("round_not_active");
    expect((await api("POST", `/admin/rounds/${r1}/hide`)).body).toEqual({ hidden: true });
    expect(fake.hiddenRecordings.has(`prefix/${r1}`)).toBe(true);
    expect((await api("GET", `/rounds/${r1}`)).status).toBe(404);
    expect((await api("GET", "/replays")).body.replays).toHaveLength(0);
  });
});

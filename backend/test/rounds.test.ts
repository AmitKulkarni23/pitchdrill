// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, describe, expect, mock, test } from "bun:test";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

const createStageToken = mock(async (_: unknown) => "stage-token");
const createChatToken = mock(async (_: unknown) => ({ token: "chat-token", sessionExpirationTime: "s", tokenExpirationTime: "t" }));
// mock.module is process-wide in bun, so every export of lib/ivs must exist for the other test files.
const unused = mock(async () => undefined);
mock.module("../src/lib/ivs", () => ({
  createStageToken,
  createChatToken,
  createStage: unused,
  createRoom: unused,
  deleteStage: unused,
  deleteRoom: unused,
  getActiveSessionId: unused,
  listPublishingUserIds: unused,
  startComposition: unused,
  stopComposition: unused,
}));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { createBooking } = await import("../src/lib/bookings");
const { getBrief, getRoundMeta, liveRounds, toPublicRound, joinRound, watchRound } = await import("../src/lib/rounds");
const { requireVoterId } = await import("../src/lib/validation");
const { slotsForDate } = await import("../src/lib/slots");

const slots = slotsForDate("2099-05-01");
const BOOKED_AT = Date.parse("2099-05-01T12:00:00.000Z");
const T = (slotId: string) => Date.parse(slotId);
const briefs = { product: { name: "W", price: "$1", tagline: "t" }, seller: "SELLER-SECRET", buyer: "BUYER-PERSONA", source: "openrouter" };
let n = 0;

/** Pairs a seller and a buyer, then sets META fields as the lifecycle would. */
async function pair(slotId: string, fields: Record<string, unknown> = {}) {
  const seller = await createBooking({ slotId, handle: `sel_${n}`, role: "seller" }, BOOKED_AT + n++);
  const buyer = await createBooking({ slotId, handle: `buy_${n}`, role: "buyer" }, BOOKED_AT + n++);
  const roundId = buyer.booking.roundId!;
  const sets = Object.keys(fields);
  await db.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `ROUND#${roundId}`, SK: "META" },
      UpdateExpression: `SET ${sets.map((k) => `#${k} = :${k}`).join(", ")}`,
      ExpressionAttributeNames: Object.fromEntries(sets.map((k) => [`#${k}`, k])),
      ExpressionAttributeValues: Object.fromEntries(sets.map((k) => [`:${k}`, fields[k]])),
    }),
  );
  return { roundId, seller, buyer };
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("rounds", () => {
  beforeAll(createLocalTable);

  test("toPublicRound: should never include briefs, booking IDs or ARNs", async () => {
    process.env.RECORDINGS_CDN_DOMAIN_ENV = "cdn.example.com";
    const { roundId } = await pair(slots[0]!, { briefs, stageArn: "arn:stage", chatRoomArn: "arn:room", compositionArn: "arn:comp", recordingPath: "a/multivariant.m3u8", status: "ended" });
    const pub = toPublicRound(await getRoundMeta(roundId));
    const text = JSON.stringify(pub);
    for (const secret of ["SELLER-SECRET", "BUYER-PERSONA", "arn:", "BookingId", "bookingId", "briefs"]) expect(text).not.toContain(secret);
    expect(pub.replayUrl).toBe("https://cdn.example.com/a/multivariant.m3u8");
    expect(Object.keys(pub).sort()).toEqual(["buyerHandle", "replayUrl", "roundId", "sellerHandle", "slotId", "status", "votesNotSold", "votesSold"]);
  });

  test("getRoundMeta: given hidden or missing round, should 404", async () => {
    const { roundId } = await pair(slots[1]!, { hidden: true });
    expect(getRoundMeta(roundId)).rejects.toMatchObject({ status: 404, code: "round_not_found" });
    expect(getRoundMeta("nope")).rejects.toMatchObject({ status: 404 });
  });

  test("liveRounds: should list only ready/live rounds of the current slot", async () => {
    const s = slots[4]!;
    const ready = await pair(s, { status: "ready" });
    const live = await pair(s, { status: "live" });
    await pair(s, { status: "ended" });
    await pair(s, { status: "paired" });
    await pair(s, { status: "ready", hidden: true });
    await pair(slots[8]!, { status: "ready" }); // another slot, not current
    const ids = (await liveRounds(T(s))).map((r) => r.roundId).sort();
    expect(ids).toEqual([ready.roundId, live.roundId].sort());
    expect(await liveRounds(T(s) + 6 * 60_000 + 20 * 60_000)).toEqual([]);
  });

  test("getBrief: seller gets the seller brief, buyer gets the buyer brief", async () => {
    const s = slots[10]!;
    const { roundId, seller, buyer } = await pair(s, { briefs, status: "ready" });
    const now = T(s) - 20_000;
    expect(await getBrief(seller.ticket, roundId, now)).toEqual({ product: briefs.product, brief: "SELLER-SECRET", role: "seller" });
    expect(await getBrief(buyer.ticket, roundId, now)).toEqual({ product: briefs.product, brief: "BUYER-PERSONA", role: "buyer" });
  });

  test("getBrief: before T-30s, should return brief_not_yet with availableAt", async () => {
    const s = slots[11]!;
    const { roundId, seller } = await pair(s, { briefs, status: "ready" });
    const err = await getBrief(seller.ticket, roundId, T(s) - 31_000).catch((e) => e);
    expect(err).toMatchObject({ status: 403, code: "brief_not_yet", extra: { availableAt: new Date(T(s) - 30_000).toISOString() } });
  });

  test("getBrief: briefs missing should 503; ticket from another round should 403", async () => {
    const s = slots[12]!;
    const a = await pair(s, { status: "ready" });
    const b = await pair(s, { briefs, status: "ready" });
    expect(getBrief(a.seller.ticket, a.roundId, T(s))).rejects.toMatchObject({ status: 503, code: "brief_pending" });
    expect(getBrief(a.seller.ticket, b.roundId, T(s))).rejects.toMatchObject({ status: 403, code: "not_your_round" });
  });

  test("join: should request PUBLISH+SUBSCRIBE token with userId bookingId and order attribute", async () => {
    const s = slots[13]!;
    const { roundId, seller, buyer } = await pair(s, { status: "ready", stageArn: "arn:stage/x", chatRoomArn: "arn:room/x" });
    createStageToken.mockClear();
    const out = await joinRound(buyer.ticket, roundId);
    expect(out.stageToken).toBe("stage-token");
    expect(out.chatToken.token).toBe("chat-token");
    expect(createStageToken).toHaveBeenCalledWith({
      stageArn: "arn:stage/x",
      userId: buyer.booking.bookingId,
      attributes: { handle: buyer.booking.handle, role: "buyer", order: "2" },
      capabilities: ["PUBLISH", "SUBSCRIBE"],
    });
    expect(createChatToken).toHaveBeenCalledWith({ roomIdentifier: "arn:room/x", userId: buyer.booking.bookingId, capabilities: [], attributes: { nickname: buyer.booking.handle, role: "buyer" } });
    await joinRound(seller.ticket, roundId);
    expect((createStageToken.mock.calls.at(-1)![0] as any).attributes.order).toBe("1");
  });

  test("join: given status ended, should return round_not_joinable", async () => {
    const { roundId, seller } = await pair(slots[14]!, { status: "ended", stageArn: "arn:stage/y", chatRoomArn: "arn:room/y" });
    const err = await joinRound(seller.ticket, roundId).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: "round_not_joinable", extra: { status: "ended" } });
  });

  test("watch: should request SUBSCRIBE-only token for viewer-<voterId>", async () => {
    const { roundId } = await pair(slots[15]!, { status: "live", stageArn: "arn:stage/z", chatRoomArn: "arn:room/z" });
    const voterId = "123e4567-e89b-42d3-a456-426614174000";
    createStageToken.mockClear();
    expect(await watchRound(roundId, voterId)).toEqual({ stageToken: "stage-token" });
    expect(createStageToken).toHaveBeenCalledWith({ stageArn: "arn:stage/z", userId: `viewer-${voterId}`, attributes: {}, capabilities: ["SUBSCRIBE"] });
  });
});

describe("requireVoterId", () => {
  test("given invalid voterId, should 400", () => {
    expect(() => requireVoterId({ voterId: "nope" })).toThrow(expect.objectContaining({ status: 400, code: "bad_voter" }));
    expect(() => requireVoterId({})).toThrow();
    expect(requireVoterId({ voterId: "123e4567-e89b-42d3-a456-426614174000" })).toBe("123e4567-e89b-42d3-a456-426614174000");
  });
});

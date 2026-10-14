// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const generate = mock();
const createStage = mock();
const createRoom = mock();
const deleteStage = mock();
const deleteRoom = mock();
const { fallbackBriefs } = await import("../src/lib/fallbackBriefs");
mock.module("../src/lib/briefs", () => ({ generateBriefs: generate, fallbackBriefs }));
mock.module("../src/lib/ivs", () => ({ createStage, createRoom, deleteStage, deleteRoom }));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { createBooking, getBookingByTicket } = await import("../src/lib/bookings");
const { tick } = await import("../src/handlers/slotTick");
const { slotsForDate } = await import("../src/lib/slots");

const slots = slotsForDate("2099-02-01");
const BOOKED_AT = Date.parse("2099-02-01T12:00:00.000Z");
const T = (slotId: string) => Date.parse(slotId);
const item = async (PK: string, SK: string) => (await db.send(new GetCommand({ TableName: TABLE, Key: { PK, SK } }))).Item;
const roundsOf = async (slotId: string) => {
  const { Items } = await db.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p AND begins_with(SK, :r)", ExpressionAttributeValues: { ":p": `SLOT#${slotId}`, ":r": "ROUND#" } }),
  );
  return Promise.all((Items ?? []).map((i) => item(`ROUND#${i.roundId}`, "META")));
};
/** A waiter as if a simultaneous booking race had left it unpaired. */
async function seedWaiter(slotId: string, handle: string, role: "seller" | "buyer", createdAt: string) {
  const bookingId = `seed-${handle}`;
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `SLOT#${slotId}`, SK: `BOOKING#${bookingId}`, slotId, bookingId, handle, role, createdAt, status: "waiting" } }));
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `SLOT#${slotId}`, SK: `WAIT#${role}#${createdAt}#${bookingId}`, bookingId, handle } }));
  await db.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `SLOT#${slotId}`, SK: "STATS" },
      UpdateExpression: `ADD ${role === "seller" ? "waitingSellers" : "waitingBuyers"} :one`,
      ExpressionAttributeValues: { ":one": 1 },
    }),
  );
  return bookingId;
}

const briefs = { product: { name: "W", price: "$1", tagline: "t" }, seller: "s", buyer: "b", source: "openrouter" };
let n = 0;

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("slotTick open", () => {
  beforeAll(createLocalTable);
  beforeEach(() => {
    for (const m of [generate, createStage, createRoom, deleteStage, deleteRoom]) m.mockReset();
    generate.mockResolvedValue(briefs);
    createStage.mockImplementation(async (id: string) => `arn:stage/${id}`);
    createRoom.mockImplementation(async (id: string) => `arn:room/${id}`);
  });

  test("given now outside any slot window, should do nothing", async () => {
    await tick(Date.parse("2099-02-01T10:00:00.000Z"));
    await tick(T(slots[0]!) - 6 * 60_000);
    expect(createStage).not.toHaveBeenCalled();
  });

  test("given 2 waiting sellers and 1 waiting buyer, should pair the oldest seller and mark the other no_opponent", async () => {
    const s = slots[0]!;
    const old = await seedWaiter(s, "old_seller", "seller", "2099-02-01T12:00:00.001Z");
    const newer = await seedWaiter(s, "new_seller", "seller", "2099-02-01T12:00:00.002Z");
    const buyer = await seedWaiter(s, "the_buyer", "buyer", "2099-02-01T12:00:00.003Z");
    await tick(T(s) - 5 * 60_000);
    const [o, nw, b] = await Promise.all([old, newer, buyer].map((id) => item(`SLOT#${s}`, `BOOKING#${id}`)));
    expect(o).toMatchObject({ status: "paired", opponentHandle: "the_buyer" });
    expect(b).toMatchObject({ status: "paired", opponentHandle: "old_seller" });
    expect(nw?.status).toBe("no_opponent");
    expect(await item(`SLOT#${s}`, "STATS")).toMatchObject({ rounds: 1 });
    expect((await item(`SLOT#${s}`, "STATS"))?.waitingSellers).toBe(0);
  });

  test("given a paired round, should create stage + room and set status ready", async () => {
    const s = slots[1]!;
    await createBooking({ slotId: s, handle: "rd_seller", role: "seller" }, BOOKED_AT + n++);
    const { booking } = await createBooking({ slotId: s, handle: "rd_buyer", role: "buyer" }, BOOKED_AT + n++);
    await tick(T(s) - 5 * 60_000);
    const meta = await item(`ROUND#${booking.roundId}`, "META");
    expect(meta).toMatchObject({
      status: "ready",
      stageArn: `arn:stage/${booking.roundId}`,
      chatRoomArn: `arn:room/${booking.roundId}`,
      briefs,
    });
  });

  test("given briefs missing and generation failing, should store fallback briefs", async () => {
    const s = slots[2]!;
    generate.mockRejectedValue(new Error("down"));
    await createBooking({ slotId: s, handle: "fb_seller", role: "seller" }, BOOKED_AT + n++);
    const { booking } = await createBooking({ slotId: s, handle: "fb_buyer", role: "buyer" }, BOOKED_AT + n++);
    await tick(T(s) - 5 * 60_000);
    expect((await item(`ROUND#${booking.roundId}`, "META"))?.briefs.source).toBe("fallback");
  });

  test("given briefs already stored, should keep them and not generate", async () => {
    const s = slots[3]!;
    await createBooking({ slotId: s, handle: "kb_seller", role: "seller" }, BOOKED_AT + n++);
    const { booking } = await createBooking({ slotId: s, handle: "kb_buyer", role: "buyer" }, BOOKED_AT + n++);
    const existing = { ...briefs, seller: "stream-made" };
    await db.send(new PutCommand({ TableName: TABLE, Item: { ...(await item(`ROUND#${booking.roundId}`, "META")), briefs: existing } }));
    await tick(T(s) - 5 * 60_000);
    expect(generate).not.toHaveBeenCalled();
    expect((await item(`ROUND#${booking.roundId}`, "META"))?.briefs.seller).toBe("stream-made");
  });

  test("run twice, should create each stage once", async () => {
    const s = slots[4]!;
    await createBooking({ slotId: s, handle: "tw_seller", role: "seller" }, BOOKED_AT + n++);
    await createBooking({ slotId: s, handle: "tw_buyer", role: "buyer" }, BOOKED_AT + n++);
    await tick(T(s) - 5 * 60_000);
    await tick(T(s) - 5 * 60_000);
    await tick(T(s));
    expect(createStage).toHaveBeenCalledTimes(1);
    expect(createRoom).toHaveBeenCalledTimes(1);
  });

  test("given IVS failure for one round, should still open the others and clean up", async () => {
    const s = slots[5]!;
    await createBooking({ slotId: s, handle: "x1_seller", role: "seller" }, BOOKED_AT + n++);
    await createBooking({ slotId: s, handle: "x1_buyer", role: "buyer" }, BOOKED_AT + n++);
    await createBooking({ slotId: s, handle: "x2_seller", role: "seller" }, BOOKED_AT + n++);
    await createBooking({ slotId: s, handle: "x2_buyer", role: "buyer" }, BOOKED_AT + n++);
    let first = true;
    createRoom.mockImplementation(async (id: string) => {
      if (first) {
        first = false;
        throw new Error("ivs down");
      }
      return `arn:room/${id}`;
    });
    await tick(T(s) - 5 * 60_000);
    const statuses = (await roundsOf(s)).map((r) => r?.status).sort();
    expect(statuses).toEqual(["paired", "ready"]);
    expect(deleteStage).toHaveBeenCalledTimes(1); // orphaned stage removed
    await tick(T(s)); // the failed round is retried next minute
    expect((await roundsOf(s)).every((r) => r?.status === "ready")).toBe(true);
  });

  test("booking status reflects no_opponent via ticket", async () => {
    const s = slots[6]!;
    const { ticket } = await createBooking({ slotId: s, handle: "lonely", role: "seller" }, BOOKED_AT + n++);
    await tick(T(s) - 5 * 60_000);
    expect((await getBookingByTicket(ticket)).status).toBe("no_opponent");
  });
});

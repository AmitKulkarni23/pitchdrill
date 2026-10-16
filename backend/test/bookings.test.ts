// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set (see CLAUDE.md).
import { beforeAll, describe, expect, test } from "bun:test";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "../src/lib/db";
import { createBooking, getBookingByTicket } from "../src/lib/bookings";
import { slotsForDate } from "../src/lib/slots";
import { createLocalTable } from "../src/dev/localTable";

const slots = slotsForDate("2099-01-01");
const NOW = Date.parse("2099-01-01T12:00:00.000Z"); // 4 AM Pacific, all of that day's slots are open
let tick = 0; // distinct createdAt per booking so queue order is deterministic
const book = (slotId: string, handle: string, role: string, now = NOW + tick++) => createBooking({ slotId, handle, role }, now);
const get = async (PK: string, SK: string) => (await db.send(new GetCommand({ TableName: TABLE, Key: { PK, SK } }))).Item;

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("bookings", () => {
  beforeAll(createLocalTable);

  test("pairs first-come-first-serve; extra seller waits", async () => {
    const s = slots[0]!;
    const amit = await book(s, "amit", "seller");
    const sam = await book(s, "sam", "seller");
    const riya = await book(s, "riya", "buyer");
    const jo = await book(s, "jo_1", "buyer");
    const kai = await book(s, "kai", "seller");

    expect(amit.booking).toMatchObject({ status: "waiting" });
    expect(riya.booking).toMatchObject({ status: "paired", opponentHandle: "amit" });
    expect(jo.booking.opponentHandle).toBe("sam");
    expect(kai.booking.roundId).toBeUndefined();

    const amitNow = await getBookingByTicket(amit.ticket);
    expect(amitNow).toMatchObject({ status: "paired", opponentHandle: "riya", roundId: riya.booking.roundId });
    expect((await getBookingByTicket(sam.ticket)).status).toBe("paired");
  });

  test("pairing writes ROUND#/META and a slot index item; STATS stay in sync", async () => {
    const s = slots[6]!;
    for (const h of ["s_a", "s_b", "s_c"]) await book(s, h, "seller");
    const b1 = await book(s, "b_a", "buyer");
    await book(s, "b_b", "buyer");
    const roundId = b1.booking.roundId!;
    expect(await get(`ROUND#${roundId}`, "META")).toMatchObject({ roundId, slotId: s, sellerHandle: "s_a", buyerHandle: "b_a", status: "paired", votesSold: 0, votesNotSold: 0 });
    expect(await get(`SLOT#${s}`, `ROUND#${roundId}`)).toEqual({ PK: `SLOT#${s}`, SK: `ROUND#${roundId}`, roundId });
    expect(await get(`SLOT#${s}`, "STATS")).toMatchObject({ sellers: 3, buyers: 2, waitingSellers: 1, rounds: 2 });
  });

  test("handle is unique per slot, case-insensitive", async () => {
    await book(slots[1]!, "Pat", "seller");
    expect(book(slots[1]!, "pat", "buyer")).rejects.toMatchObject({ code: "handle_taken" });
    expect((await book(slots[2]!, "pat", "buyer")).booking.handle).toBe("pat");
  });

  test("concurrent buyers never share a seller", async () => {
    const s = slots[3]!;
    for (let i = 0; i < 4; i++) await book(s, `seller${i}`, "seller");
    const buyers = await Promise.all([0, 1, 2, 3].map((i) => book(s, `buyer${i}`, "buyer")));
    expect(new Set(buyers.map((b) => b.booking.opponentHandle)).size).toBe(4);
  });

  test("caps a slot at 4 sellers and 4 buyers, even when booked at once", async () => {
    const s = slots[5]!;
    const sellers = await Promise.allSettled([0, 1, 2, 3, 4, 5].map((i) => book(s, `cap_s${i}`, "seller")));
    expect(sellers.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    expect(sellers.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason.code)).toEqual(["slot_full", "slot_full"]);
    expect((await book(s, "cap_b0", "buyer")).booking.roundId).toBeDefined();
  });

  test("rejects bad input and bad tickets", async () => {
    expect(book("2099-01-01T23:05:00.000Z", "amit", "seller")).rejects.toMatchObject({ code: "bad_slot" });
    expect(book(slots[4]!, "amit", "seller", Date.parse(slots[4]!))).rejects.toMatchObject({ code: "slot_closed" });
    expect(book(slots[4]!, "a b", "seller")).rejects.toMatchObject({ code: "bad_handle" });
    expect(book(slots[4]!, "amit", "judge")).rejects.toMatchObject({ code: "bad_role" });
    expect(getBookingByTicket("nope")).rejects.toMatchObject({ code: "bad_ticket" });
  });
});

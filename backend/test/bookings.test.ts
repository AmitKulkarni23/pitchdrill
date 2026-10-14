// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set (see CLAUDE.md).
import { beforeAll, describe, expect, test } from "bun:test";
import { CreateTableCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "../src/lib/db";
import { createBooking, getBookingByTicket } from "../src/lib/bookings";
import { slotsForDate } from "../src/lib/slots";

const slots = slotsForDate("2099-01-01");
const NOW = Date.parse("2099-01-01T12:00:00.000Z"); // 4 AM Pacific, all of that day's slots are open
let tick = 0; // distinct createdAt per booking so queue order is deterministic
const book = (slotId: string, handle: string, role: string, now = NOW + tick++) => createBooking({ slotId, handle, role }, now);

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("bookings", () => {
  beforeAll(async () => {
    await db.send(new DeleteTableCommand({ TableName: TABLE })).catch(() => {});
    await db.send(
      new CreateTableCommand({
        TableName: TABLE,
        BillingMode: "PAY_PER_REQUEST",
        KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }, { AttributeName: "SK", KeyType: "RANGE" }],
        AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }, { AttributeName: "SK", AttributeType: "S" }],
      }),
    );
  });

  test("pairs first-come-first-serve; extra seller waits", async () => {
    const s = slots[0]!;
    const amit = await book(s, "amit", "seller");
    const sam = await book(s, "sam", "seller");
    const riya = await book(s, "riya", "buyer");
    const jo = await book(s, "jo_1", "buyer");
    const kai = await book(s, "kai", "seller");

    expect(amit.booking.roundId).toBeUndefined();
    expect(riya.booking.opponentHandle).toBe("amit");
    expect(jo.booking.opponentHandle).toBe("sam");
    expect(kai.booking.roundId).toBeUndefined();

    const amitNow = await getBookingByTicket(amit.ticket);
    expect(amitNow.opponentHandle).toBe("riya");
    expect(amitNow.roundId).toBe(riya.booking.roundId!);
  });

  test("handle is unique per slot, case-insensitive", async () => {
    await book(slots[1]!, "Pat", "seller");
    expect(book(slots[1]!, "pat", "buyer")).rejects.toMatchObject({ code: "handle_taken" });
    expect((await book(slots[2]!, "pat", "buyer")).booking.handle).toBe("pat");
  });

  test("concurrent buyers never share a seller", async () => {
    const s = slots[3]!;
    for (let i = 0; i < 5; i++) await book(s, `seller${i}`, "seller");
    const buyers = await Promise.all([0, 1, 2, 3, 4].map((i) => book(s, `buyer${i}`, "buyer")));
    expect(new Set(buyers.map((b) => b.booking.opponentHandle)).size).toBe(5);
  });

  test("rejects bad input and bad tickets", async () => {
    expect(book("2099-01-01T23:05:00.000Z", "amit", "seller")).rejects.toMatchObject({ code: "bad_slot" });
    expect(book(slots[4]!, "amit", "seller", Date.parse(slots[4]!))).rejects.toMatchObject({ code: "slot_closed" });
    expect(book(slots[4]!, "a b", "seller")).rejects.toMatchObject({ code: "bad_handle" });
    expect(book(slots[4]!, "amit", "judge")).rejects.toMatchObject({ code: "bad_role" });
    expect(getBookingByTicket("nope")).rejects.toMatchObject({ code: "bad_ticket" });
  });
});

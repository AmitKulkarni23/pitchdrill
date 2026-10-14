import { randomUUID } from "node:crypto";
import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "./db";
import { isBookable, isValidSlot } from "./slots";
import { hashTicket, newTicket } from "./tickets";
import { UserError } from "./http";
import { metrics } from "./observability";
import { MetricUnit } from "@aws-lambda-powertools/metrics";

export type Role = "seller" | "buyer";
const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
const MAX_ATTEMPTS = 5;

export interface Booking {
  slotId: string;
  bookingId: string;
  handle: string;
  role: Role;
  createdAt: string;
  roundId?: string;
  opponentHandle?: string;
}

/**
 * Books a slot and pairs with the oldest unpaired booking of the other role, if any.
 * Returns the raw ticket once; only its hash is stored.
 */
export async function createBooking(input: { slotId: unknown; handle: unknown; role: unknown }, now = Date.now()) {
  const { slotId, handle, role } = input;
  if (typeof slotId !== "string" || !isValidSlot(slotId)) throw new UserError(400, "bad_slot", "That slot doesn't exist.");
  if (!isBookable(slotId, now))
    throw new UserError(400, "slot_closed", "Booking for that slot isn't open. Slots open 7 days ahead and close 5 minutes before the start.");
  if (typeof handle !== "string" || !HANDLE_RE.test(handle))
    throw new UserError(400, "bad_handle", "Handles are 3–20 letters, numbers or underscores.");
  if (role !== "seller" && role !== "buyer") throw new UserError(400, "bad_role", "Role must be seller or buyer.");

  const pk = `SLOT#${slotId}`;
  const other: Role = role === "seller" ? "buyer" : "seller";
  const ticket = newTicket();
  const booking: Booking = { slotId, bookingId: randomUUID(), handle, role, createdAt: new Date(now).toISOString() };

  // ponytail: a seller and buyer booking at the same instant can both see an empty queue and both wait.
  // Fix with a sweep at slot time that pairs leftover waiters if it shows up in practice.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { Items } = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :wait)",
        ExpressionAttributeValues: { ":pk": pk, ":wait": `WAIT#${other}#` },
        Limit: 1,
      }),
    );
    const waiting = Items?.[0];
    const roundId = waiting ? randomUUID() : undefined;
    const mine: Booking = waiting ? { ...booking, roundId, opponentHandle: waiting.handle } : booking;

    const writes: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]> = [
      {
        Put: {
          TableName: TABLE,
          Item: { PK: pk, SK: `HANDLE#${handle.toLowerCase()}` },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      { Put: { TableName: TABLE, Item: { PK: `TICKET#${hashTicket(ticket)}`, SK: "TICKET", slotId, bookingId: booking.bookingId } } },
      { Put: { TableName: TABLE, Item: { PK: pk, SK: `BOOKING#${booking.bookingId}`, ...mine } } },
    ];
    if (waiting) {
      const [seller, buyer] = role === "seller" ? [mine, waiting] : [waiting, mine];
      writes.push(
        { Delete: { TableName: TABLE, Key: { PK: pk, SK: waiting.SK }, ConditionExpression: "attribute_exists(PK)" } },
        {
          Update: {
            TableName: TABLE,
            Key: { PK: pk, SK: `BOOKING#${waiting.bookingId}` },
            UpdateExpression: "SET roundId = :r, opponentHandle = :h",
            ExpressionAttributeValues: { ":r": roundId, ":h": handle },
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: {
              PK: pk,
              SK: `ROUND#${roundId}`,
              roundId,
              sellerBookingId: seller.bookingId,
              sellerHandle: seller.handle,
              buyerBookingId: buyer.bookingId,
              buyerHandle: buyer.handle,
            },
          },
        },
      );
    } else {
      writes.push({
        Put: {
          TableName: TABLE,
          Item: { PK: pk, SK: `WAIT#${role}#${booking.createdAt}#${booking.bookingId}`, bookingId: booking.bookingId, handle },
        },
      });
    }

    try {
      await db.send(new TransactWriteCommand({ TransactItems: writes }));
      metrics.addMetric("BookingCreated", MetricUnit.Count, 1);
      if (waiting) metrics.addMetric("RoundPaired", MetricUnit.Count, 1);
      return { ticket, booking: mine };
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      const reasons = e.CancellationReasons ?? [];
      if (reasons[0]?.Code === "ConditionalCheckFailed")
        throw new UserError(409, "handle_taken", "That handle is already booked in this slot.");
      // Someone else grabbed our opponent (or a transaction conflict): look again.
    }
  }
  throw new UserError(503, "busy", "This slot is busy right now. Please try again.");
}

/** Looks up the booking a ticket belongs to. */
export async function getBookingByTicket(ticket: unknown): Promise<Booking> {
  if (typeof ticket !== "string" || !ticket) throw new UserError(401, "no_ticket", "Missing ticket.");
  const { Item: t } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `TICKET#${hashTicket(ticket)}`, SK: "TICKET" } }));
  if (!t) throw new UserError(404, "bad_ticket", "That ticket isn't valid.");
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `SLOT#${t.slotId}`, SK: `BOOKING#${t.bookingId}` } }));
  if (!Item) throw new UserError(404, "bad_ticket", "That ticket isn't valid.");
  const { PK, SK, ...booking } = Item;
  return booking as Booking;
}

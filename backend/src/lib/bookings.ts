import { randomUUID } from "node:crypto";
import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "./db";
import { isBookable, isValidSlot } from "./slots";
import { hashTicket, newTicket } from "./tickets";
import { UserError } from "./http";
import { logger, metrics } from "./observability";
import { MetricUnit } from "@aws-lambda-powertools/metrics";

export type Role = "seller" | "buyer";
export type BookingStatus = "waiting" | "paired" | "no_opponent";
const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
const MAX_ATTEMPTS = 5;
/** At most this many sellers and this many buyers per slot, so at most this many rounds. */
export const MAX_PER_ROLE = 4;

export interface Booking {
  slotId: string;
  bookingId: string;
  handle: string;
  role: Role;
  createdAt: string;
  status: BookingStatus;
  roundId?: string;
  opponentHandle?: string;
}

type TransactItems = NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]>;
/** A WAIT# queue item as read back from the slot partition. */
interface Waiter {
  SK: string;
  bookingId: string;
  handle: string;
}

const other = (role: Role): Role => (role === "seller" ? "buyer" : "seller");
const waitingAttr = (role: Role) => (role === "seller" ? "waitingSellers" : "waitingBuyers");

/** Round META + slot index item for a new pair. Shared by booking-time and slot-time pairing. */
function roundWrites(slotId: string, roundId: string, seller: { bookingId: string; handle: string }, buyer: { bookingId: string; handle: string }): TransactItems {
  return [
    {
      Put: {
        TableName: TABLE,
        Item: {
          PK: `ROUND#${roundId}`,
          SK: "META",
          roundId,
          slotId,
          sellerBookingId: seller.bookingId,
          sellerHandle: seller.handle,
          buyerBookingId: buyer.bookingId,
          buyerHandle: buyer.handle,
          status: "paired",
          votesSold: 0,
          votesNotSold: 0,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
    { Put: { TableName: TABLE, Item: { PK: `SLOT#${slotId}`, SK: `ROUND#${roundId}`, roundId } } },
  ];
}

/** Takes a waiter out of the queue and pairs its booking. The conditional delete stops a waiter from being paired twice. */
function dequeueWrites(slotId: string, waiter: Waiter, roundId: string, opponentHandle: string): TransactItems {
  const pk = `SLOT#${slotId}`;
  return [
    { Delete: { TableName: TABLE, Key: { PK: pk, SK: waiter.SK }, ConditionExpression: "attribute_exists(PK)" } },
    {
      Update: {
        TableName: TABLE,
        Key: { PK: pk, SK: `BOOKING#${waiter.bookingId}` },
        UpdateExpression: "SET roundId = :r, opponentHandle = :h, #s = :paired",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":r": roundId, ":h": opponentHandle, ":paired": "paired" },
      },
    },
  ];
}

const oldestWaiters = async (slotId: string, role: Role, limit?: number): Promise<Waiter[]> =>
  ((
    await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :wait)",
        ExpressionAttributeValues: { ":pk": `SLOT#${slotId}`, ":wait": `WAIT#${role}#` },
        Limit: limit,
        ConsistentRead: true,
      }),
    )
  ).Items ?? []) as Waiter[];

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
  const ticket = newTicket();
  const base = { slotId, bookingId: randomUUID(), handle, role: role as Role, createdAt: new Date(now).toISOString() };

  // Two bookings at the same instant can both see an empty queue and both wait; SlotTick pairs them at T-5m.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [waiting] = await oldestWaiters(slotId, other(role), 1);
    const roundId = waiting ? randomUUID() : undefined;
    const mine: Booking = waiting
      ? { ...base, status: "paired", roundId, opponentHandle: waiting.handle }
      : { ...base, status: "waiting" };

    const writes: TransactItems = [
      // Index 0: handle guard (CancellationReasons[0] → handle_taken).
      {
        Put: {
          TableName: TABLE,
          Item: { PK: pk, SK: `HANDLE#${handle.toLowerCase()}` },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      // Index 1: seat cap plus queue/round counters, one item (CancellationReasons[1] → slot_full).
      {
        Update: {
          TableName: TABLE,
          Key: { PK: pk, SK: "STATS" },
          UpdateExpression: waiting ? "ADD #role :one, #wait :minus, rounds :one" : "ADD #role :one, #wait :one",
          ConditionExpression: "attribute_not_exists(#role) OR #role < :max",
          ExpressionAttributeNames: { "#role": `${role}s`, "#wait": waitingAttr(waiting ? other(role) : role) },
          ExpressionAttributeValues: { ":one": 1, ":max": MAX_PER_ROLE, ...(waiting && { ":minus": -1 }) },
        },
      },
      { Put: { TableName: TABLE, Item: { PK: `TICKET#${hashTicket(ticket)}`, SK: "TICKET", slotId, bookingId: base.bookingId } } },
      { Put: { TableName: TABLE, Item: { PK: pk, SK: `BOOKING#${base.bookingId}`, ...mine } } },
    ];
    if (waiting && roundId) {
      const [seller, buyer] = role === "seller" ? [mine, waiting] : [waiting, mine];
      writes.push(...dequeueWrites(slotId, waiting, roundId, handle), ...roundWrites(slotId, roundId, seller, buyer));
    } else {
      writes.push({
        Put: {
          TableName: TABLE,
          Item: { PK: pk, SK: `WAIT#${role}#${base.createdAt}#${base.bookingId}`, bookingId: base.bookingId, handle },
        },
      });
    }

    try {
      await db.send(new TransactWriteCommand({ TransactItems: writes }));
      metrics.addMetric("BookingCreated", MetricUnit.Count, 1);
      if (waiting) metrics.addMetric("RoundPaired", MetricUnit.Count, 1);
      logger.info("Booking created", { slotId, bookingId: base.bookingId, role, roundId });
      return { ticket, booking: mine };
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      const reasons = e.CancellationReasons ?? [];
      if (reasons[0]?.Code === "ConditionalCheckFailed")
        throw new UserError(409, "handle_taken", "That handle is already booked in this slot.");
      if (reasons[1]?.Code === "ConditionalCheckFailed")
        throw new UserError(409, "slot_full", `All ${MAX_PER_ROLE} ${role} seats in this slot are taken. Try another time.`);
      // Someone else grabbed our opponent (or a transaction conflict): look again.
      logger.info("Booking transaction retry", { slotId, attempt, reasons: reasons.map((r) => r.Code) });
    }
  }
  throw new UserError(503, "busy", "This slot is busy right now. Please try again.");
}

/**
 * Slot-time sweep: pairs leftover waiters oldest-first, then marks whoever is left `no_opponent`.
 * Safe to run more than once: every write is conditional on the WAIT# item still existing.
 */
export async function sweepWaiters(slotId: string): Promise<void> {
  const pk = `SLOT#${slotId}`;
  const [sellers, buyers] = await Promise.all([oldestWaiters(slotId, "seller"), oldestWaiters(slotId, "buyer")]);
  const pairs = Math.min(sellers.length, buyers.length);
  for (let i = 0; i < pairs; i++) {
    const [seller, buyer] = [sellers[i]!, buyers[i]!];
    const roundId = randomUUID();
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: TABLE,
                Key: { PK: pk, SK: "STATS" },
                UpdateExpression: "ADD waitingSellers :minus, waitingBuyers :minus, rounds :one",
                ExpressionAttributeValues: { ":minus": -1, ":one": 1 },
              },
            },
            ...dequeueWrites(slotId, seller, roundId, buyer.handle),
            ...dequeueWrites(slotId, buyer, roundId, seller.handle),
            ...roundWrites(slotId, roundId, seller, buyer),
          ],
        }),
      );
      metrics.addMetric("RoundPaired", MetricUnit.Count, 1);
      logger.info("Paired leftover waiters", { slotId, roundId });
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
      logger.info("Leftover pair already handled", { slotId });
    }
  }
  const leftovers: [Role, Waiter][] = [
    ...sellers.slice(pairs).map((w) => ["seller", w] as [Role, Waiter]),
    ...buyers.slice(pairs).map((w) => ["buyer", w] as [Role, Waiter]),
  ];
  for (const [role, w] of leftovers) {
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            { Delete: { TableName: TABLE, Key: { PK: pk, SK: w.SK }, ConditionExpression: "attribute_exists(PK)" } },
            {
              Update: {
                TableName: TABLE,
                Key: { PK: pk, SK: `BOOKING#${w.bookingId}` },
                UpdateExpression: "SET #s = :s",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: { ":s": "no_opponent" },
              },
            },
            {
              Update: {
                TableName: TABLE,
                Key: { PK: pk, SK: "STATS" },
                UpdateExpression: "ADD #w :minus",
                ExpressionAttributeNames: { "#w": waitingAttr(role) },
                ExpressionAttributeValues: { ":minus": -1 },
              },
            },
          ],
        }),
      );
      logger.info("No opponent for booking", { slotId, bookingId: w.bookingId, role });
    } catch (e) {
      if (!(e instanceof TransactionCanceledException)) throw e;
    }
  }
}

/** Looks up the booking a ticket belongs to. */
export async function getBookingByTicket(ticket: unknown): Promise<Booking> {
  if (typeof ticket !== "string" || !ticket || ticket.length > 100) throw new UserError(401, "no_ticket", "Missing ticket.");
  const { Item: t } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `TICKET#${hashTicket(ticket)}`, SK: "TICKET" } }));
  if (!t) throw new UserError(404, "bad_ticket", "That ticket isn't valid.");
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `SLOT#${t.slotId}`, SK: `BOOKING#${t.bookingId}` } }));
  if (!Item) throw new UserError(404, "bad_ticket", "That ticket isn't valid.");
  const { PK, SK, ...booking } = Item;
  return booking as Booking;
}

import { randomUUID } from "node:crypto";
import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "./db";
import { isBookable, isValidSlot } from "./slots";
import { roundPk, slotPk, STATS_SK } from "./keys";
import { hashTicket, newTicket } from "./tickets";
import { UserError } from "./http";
import { metrics } from "./observability";
import { MetricUnit } from "@aws-lambda-powertools/metrics";

export type Role = "seller" | "buyer";
const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
const MAX_ATTEMPTS = 5;
const waitingAttr = (role: Role) => (role === "seller" ? "waitingSellers" : "waitingBuyers");

export interface Booking {
  slotId: string;
  bookingId: string;
  handle: string;
  role: Role;
  createdAt: string;
  status: "waiting" | "paired" | "no_opponent";
  roundId?: string;
  opponentHandle?: string;
}

type Write = NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]>[number];
interface Side {
  bookingId: string;
  handle: string;
}

/** Marks a waiting booking as paired with an opponent in a round. */
const markPaired = (slotId: string, bookingId: string, roundId: string, opponentHandle: string): Write => ({
  Update: {
    TableName: TABLE,
    Key: { PK: slotPk(slotId), SK: `BOOKING#${bookingId}` },
    UpdateExpression: "SET roundId = :r, opponentHandle = :h, #s = :paired",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":r": roundId, ":h": opponentHandle, ":paired": "paired" },
  },
});

/** The round's canonical META item plus its index item in the slot partition. */
const roundItems = (slotId: string, roundId: string, seller: Side, buyer: Side): Write[] => [
  {
    Put: {
      TableName: TABLE,
      Item: {
        PK: roundPk(roundId),
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
    },
  },
  { Put: { TableName: TABLE, Item: { PK: slotPk(slotId), SK: `ROUND#${roundId}`, roundId } } },
];

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

  const pk = slotPk(slotId);
  const other: Role = role === "seller" ? "buyer" : "seller";
  const ticket = newTicket();
  const booking: Booking = { slotId, bookingId: randomUUID(), handle, role, createdAt: new Date(now).toISOString(), status: "waiting" };

  // A seller and buyer booking at the same instant can both see an empty queue and both wait;
  // the SlotTick sweep (openSlot) pairs any such leftovers.
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
    const mine: Booking = waiting ? { ...booking, status: "paired", roundId, opponentHandle: waiting.handle } : booking;

    const writes: Write[] = [
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
      const [seller, buyer] = (role === "seller" ? [mine, waiting] : [waiting, mine]) as unknown as [Side, Side];
      writes.push(
        { Delete: { TableName: TABLE, Key: { PK: pk, SK: waiting.SK }, ConditionExpression: "attribute_exists(PK)" } },
        markPaired(slotId, waiting.bookingId, roundId!, handle),
        ...roundItems(slotId, roundId!, seller, buyer),
        {
          Update: {
            TableName: TABLE,
            Key: { PK: pk, SK: STATS_SK },
            UpdateExpression: `ADD ${waitingAttr(other)} :dec, rounds :one`,
            ExpressionAttributeValues: { ":dec": -1, ":one": 1 },
          },
        },
      );
    } else {
      writes.push(
        {
          Update: {
            TableName: TABLE,
            Key: { PK: pk, SK: STATS_SK },
            UpdateExpression: `ADD ${waitingAttr(role)} :one`,
            ExpressionAttributeValues: { ":one": 1 },
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: { PK: pk, SK: `WAIT#${role}#${booking.createdAt}#${booking.bookingId}`, bookingId: booking.bookingId, handle },
          },
        },
      );
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
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: slotPk(t.slotId), SK: `BOOKING#${t.bookingId}` } }));
  if (!Item) throw new UserError(404, "bad_ticket", "That ticket isn't valid.");
  const { PK, SK, ...booking } = Item;
  return booking as Booking;
}

interface Waiter extends Side {
  SK: string;
}

/** All waiting entries of a role in a slot, oldest first. */
export async function listWaiting(slotId: string, role: Role): Promise<Waiter[]> {
  const out: Waiter[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :wait)",
        ExpressionAttributeValues: { ":pk": slotPk(slotId), ":wait": `WAIT#${role}#` },
        ExclusiveStartKey,
      }),
    );
    out.push(...(page.Items as Waiter[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

/**
 * Pairs one waiting seller with one waiting buyer in a single transaction.
 * Returns the new round ID, or undefined if either waiter was taken meanwhile.
 */
export async function pairWaiting(slotId: string, seller: Waiter, buyer: Waiter): Promise<string | undefined> {
  const pk = slotPk(slotId);
  const roundId = randomUUID();
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: TABLE, Key: { PK: pk, SK: seller.SK }, ConditionExpression: "attribute_exists(PK)" } },
          { Delete: { TableName: TABLE, Key: { PK: pk, SK: buyer.SK }, ConditionExpression: "attribute_exists(PK)" } },
          markPaired(slotId, seller.bookingId, roundId, buyer.handle),
          markPaired(slotId, buyer.bookingId, roundId, seller.handle),
          ...roundItems(slotId, roundId, seller, buyer),
          {
            Update: {
              TableName: TABLE,
              Key: { PK: pk, SK: STATS_SK },
              UpdateExpression: "ADD waitingSellers :dec, waitingBuyers :dec, rounds :one",
              ExpressionAttributeValues: { ":dec": -1, ":one": 1 },
            },
          },
        ],
      }),
    );
    metrics.addMetric("RoundPaired", MetricUnit.Count, 1);
    return roundId;
  } catch (e) {
    if (e instanceof TransactionCanceledException) return undefined;
    throw e;
  }
}

/** Tells a waiter nobody was found: status no_opponent, off the queue, counter decremented. */
export async function markNoOpponent(slotId: string, role: Role, waiter: Waiter): Promise<void> {
  const pk = slotPk(slotId);
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: TABLE, Key: { PK: pk, SK: waiter.SK }, ConditionExpression: "attribute_exists(PK)" } },
          {
            Update: {
              TableName: TABLE,
              Key: { PK: pk, SK: `BOOKING#${waiter.bookingId}` },
              UpdateExpression: "SET #s = :s",
              ConditionExpression: "#s = :waiting",
              ExpressionAttributeNames: { "#s": "status" },
              ExpressionAttributeValues: { ":s": "no_opponent", ":waiting": "waiting" },
            },
          },
          {
            Update: {
              TableName: TABLE,
              Key: { PK: pk, SK: STATS_SK },
              UpdateExpression: `ADD ${waitingAttr(role)} :dec`,
              ExpressionAttributeValues: { ":dec": -1 },
            },
          },
        ],
      }),
    );
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e; // already handled by a concurrent tick
  }
}

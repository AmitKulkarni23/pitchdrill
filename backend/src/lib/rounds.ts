import { BatchGetCommand, type BatchGetCommandOutput, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "./db";
import { UserError } from "./http";
import type { Briefs } from "./briefs";

export type RoundStatus = "paired" | "ready" | "live" | "cancelled" | "ended" | "closed";

export interface RoundMeta {
  roundId: string;
  slotId: string;
  sellerBookingId: string;
  sellerHandle: string;
  buyerBookingId: string;
  buyerHandle: string;
  status: RoundStatus;
  cancelReason?: "no_show" | "admin";
  stageArn?: string;
  chatRoomArn?: string;
  compositionArn?: string;
  recordingPrefix?: string;
  startedAt?: string;
  endedAt?: string;
  endedBy?: "admin";
  briefs?: Briefs;
  votesSold: number;
  votesNotSold: number;
  recordingPath?: string;
  recordingMissingLogged?: boolean;
  hidden?: boolean;
}

export const ROUND_MS = 60_000;

export async function getRound(roundId: string): Promise<RoundMeta | undefined> {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `ROUND#${roundId}`, SK: "META" }, ConsistentRead: true }));
  return Item as RoundMeta | undefined;
}

/** A round that exists and isn't hidden, or 404. */
export async function requireRound(roundId: string): Promise<RoundMeta> {
  const round = await getRound(roundId);
  if (!round || round.hidden) throw new UserError(404, "round_not_found", "That round doesn't exist.");
  return round;
}

/**
 * The public shape of a round. Explicit allowlist: booking IDs and ARNs never leave the server.
 * Briefs go public in stages: the product and seller sheet once the round is live, the buyer's persona only
 * after the buzzer (players can read the chat, so a spectator could otherwise leak it to the seller).
 */
export function toPublicRound(r: RoundMeta) {
  const productPublic = r.status === "live" || r.status === "ended" || r.status === "closed";
  const personaPublic = r.status === "ended" || r.status === "closed";
  return {
    roundId: r.roundId,
    slotId: r.slotId,
    status: r.status,
    sellerHandle: r.sellerHandle,
    buyerHandle: r.buyerHandle,
    startedAt: r.startedAt,
    endsAt: r.startedAt ? new Date(Date.parse(r.startedAt) + ROUND_MS).toISOString() : undefined,
    endedAt: r.endedAt,
    cancelReason: r.cancelReason,
    votesSold: r.votesSold ?? 0,
    votesNotSold: r.votesNotSold ?? 0,
    product: productPublic && r.briefs ? r.briefs.product : undefined,
    briefs: productPublic && r.briefs ? { seller: r.briefs.seller, buyer: personaPublic ? r.briefs.buyer : undefined } : undefined,
    replayUrl: r.recordingPath ? `https://${process.env.RECORDINGS_CDN_DOMAIN_ENV}/${r.recordingPath}` : undefined,
  };
}
export type PublicRound = ReturnType<typeof toPublicRound>;

/** Every round in a slot (index items in the slot partition → META items). */
export async function roundsOfSlot(slotId: string): Promise<RoundMeta[]> {
  const { Items = [] } = await db.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :r)",
      ExpressionAttributeValues: { ":pk": `SLOT#${slotId}`, ":r": "ROUND#" },
      ConsistentRead: true,
    }),
  );
  if (!Items.length) return [];
  // At most 4 rounds per slot, so one BatchGet; retry anything unprocessed.
  let keys: Record<string, unknown>[] | undefined = Items.map((i) => ({ PK: `ROUND#${i.roundId}`, SK: "META" }));
  const rounds: RoundMeta[] = [];
  for (let attempt = 0; keys?.length && attempt < 6; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
    const res: BatchGetCommandOutput = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: keys, ConsistentRead: true } } }));
    rounds.push(...((res.Responses?.[TABLE] ?? []) as RoundMeta[]));
    keys = res.UnprocessedKeys?.[TABLE]?.Keys;
  }
  return rounds;
}

/**
 * SETs fields on a round only if it is still in `from` status. Returns false when another writer got there first,
 * which is how every lifecycle transition stays idempotent.
 */
export async function transition(roundId: string, from: RoundStatus, set: Record<string, unknown>, remove: string[] = []): Promise<boolean> {
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = { ":from": from };
  const sets = Object.entries(set).map(([k, v], i) => {
    names[`#s${i}`] = k;
    values[`:s${i}`] = v;
    return `#s${i} = :s${i}`;
  });
  const removes = remove.map((k, i) => {
    names[`#r${i}`] = k;
    return `#r${i}`;
  });
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ROUND#${roundId}`, SK: "META" },
        UpdateExpression: [sets.length && `SET ${sets.join(", ")}`, removes.length && `REMOVE ${removes.join(", ")}`].filter(Boolean).join(" "),
        ConditionExpression: "#status = :from",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) return false;
    throw e;
  }
}

/** Stores briefs once; a second writer (stream vs. SlotTick) is a no-op. Returns false if briefs already existed. */
export async function saveBriefs(roundId: string, briefs: Briefs): Promise<boolean> {
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ROUND#${roundId}`, SK: "META" },
        UpdateExpression: "SET briefs = :b",
        ConditionExpression: "attribute_exists(PK) AND attribute_not_exists(briefs)",
        ExpressionAttributeValues: { ":b": briefs },
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) return false;
    throw e;
  }
}

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { listWaiting, markNoOpponent, pairWaiting } from "../lib/bookings";
import { generateBriefs, fallbackBriefs, type Briefs } from "../lib/briefs";
import { db, TABLE } from "../lib/db";
import { sendRoundEvent } from "../lib/chatEvents";
import { createRoom, createStage, deleteRoom, deleteStage, getActiveSessionId, listPublishingUserIds, startComposition } from "../lib/ivs";
import { roundPk, slotPk } from "../lib/keys";
import { logger, metrics } from "../lib/observability";
import { pacificDate, slotsForDate } from "../lib/slots";

const MIN = 60_000;
const OPEN_BEFORE_MS = 5 * MIN;
const LOOKBACK_MS = 20 * MIN;

type Round = Record<string, any>;

/** Slots whose start T satisfies now - 20m <= T <= now + 5m. */
export function slotsInWindow(now: number): string[] {
  const today = pacificDate(now);
  const yesterday = pacificDate(now - 24 * 60 * MIN);
  return [...slotsForDate(yesterday), ...slotsForDate(today)].filter((id) => {
    const t = Date.parse(id);
    return t >= now - LOOKBACK_MS && t <= now + OPEN_BEFORE_MS;
  });
}

/** Pairs leftover waiters oldest-first and tells the rest nobody was found. */
async function pairLeftovers(slotId: string) {
  const sellers = await listWaiting(slotId, "seller");
  const buyers = await listWaiting(slotId, "buyer");
  const pairs = Math.min(sellers.length, buyers.length);
  const left = [...sellers.slice(pairs).map((w) => ["seller", w] as const), ...buyers.slice(pairs).map((w) => ["buyer", w] as const)];
  for (let i = 0; i < pairs; i++) {
    // If the pairing transaction loses a race, both waiters stay queued and are picked up next minute.
    if (!(await pairWaiting(slotId, sellers[i]!, buyers[i]!))) logger.info("Pairing skipped, waiter taken", { slotId });
  }
  for (const [role, w] of left) await markNoOpponent(slotId, role, w);
}

async function roundsOf(slotId: string): Promise<Round[]> {
  const ids: string[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :r)",
        ExpressionAttributeValues: { ":pk": slotPk(slotId), ":r": "ROUND#" },
        ExclusiveStartKey,
      }),
    );
    ids.push(...(page.Items ?? []).map((i) => i.roundId as string));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const rounds: Round[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let keys: Record<string, unknown>[] = ids.slice(i, i + 100).map((id) => ({ PK: roundPk(id), SK: "META" }));
    while (keys.length) {
      const out = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: keys } } }));
      rounds.push(...(out.Responses?.[TABLE] ?? []));
      keys = out.UnprocessedKeys?.[TABLE]?.Keys ?? [];
    }
  }
  return rounds;
}

/** paired -> ready: make sure briefs exist, create the stage and chat room. */
async function openRound(round: Round) {
  let briefs: Briefs | undefined = round.briefs;
  if (!briefs) {
    try {
      briefs = await generateBriefs();
    } catch (e) {
      logger.warn("Using fallback briefs", { roundId: round.roundId, error: (e as Error).message });
      metrics.addMetric("BriefFallbackUsed", MetricUnit.Count, 1);
      briefs = fallbackBriefs();
    }
  }
  const stageArn = await createStage(round.roundId);
  let chatRoomArn: string | undefined;
  try {
    chatRoomArn = await createRoom(round.roundId);
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: roundPk(round.roundId), SK: "META" },
        UpdateExpression: "SET #s = :ready, stageArn = :stage, chatRoomArn = :room, briefs = if_not_exists(briefs, :briefs)",
        ConditionExpression: "#s = :paired",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":ready": "ready", ":paired": "paired", ":stage": stageArn, ":room": chatRoomArn, ":briefs": briefs },
      }),
    );
  } catch (e) {
    // A concurrent tick (or a failure) means these resources are orphans: remove them.
    await deleteStage(stageArn).catch((err) => logger.error("Stage cleanup failed", { stageArn, error: (err as Error).message }));
    if (chatRoomArn)
      await deleteRoom(chatRoomArn).catch((err) => logger.error("Room cleanup failed", { chatRoomArn, error: (err as Error).message }));
    if (e instanceof ConditionalCheckFailedException) return;
    throw e;
  }
  metrics.addMetric("RoundReady", MetricUnit.Count, 1);
}

/** T-5 minutes: pair leftovers, mark no_opponent, open every paired round. Idempotent. */
export async function openSlot(slotId: string) {
  await pairLeftovers(slotId);
  for (const round of await roundsOf(slotId)) {
    if (round.status !== "paired") continue;
    try {
      await openRound(round);
    } catch (e) {
      logger.error("Opening round failed", { slotId, roundId: round.roundId, error: (e as Error).message });
    }
  }
}

/** Moves a round from one status to another; false when a concurrent tick already moved it. */
async function transitionRound(roundId: string, from: string, to: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const sets = ["#s = :to", ...Object.keys(extra).map((k) => `${k} = :${k}`)];
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: roundPk(roundId), SK: "META" },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "#s = :from",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":from": from, ":to": to, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`:${k}`, v])) },
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) return false;
    throw e;
  }
}

/** Both the seller and the buyer must be connected and publishing on the stage. */
async function bothPublishing(round: Round): Promise<boolean> {
  const sessionId = await getActiveSessionId(round.stageArn);
  if (!sessionId) return false;
  const publishing = new Set(await listPublishingUserIds(round.stageArn, sessionId));
  return publishing.has(round.sellerBookingId) && publishing.has(round.buyerBookingId);
}

/** Chat events are best effort: a failed announcement must not undo the transition. */
async function announce(round: Round, eventName: string, attributes: Record<string, string>) {
  await sendRoundEvent(round.chatRoomArn, eventName, attributes).catch((e) =>
    logger.warn("Chat event failed", { roundId: round.roundId, eventName, error: (e as Error).message }),
  );
}

async function goLive(round: Round) {
  const compositionArn = await startComposition(round.stageArn);
  const startedAt = new Date().toISOString();
  if (!(await transitionRound(round.roundId, "ready", "live", { startedAt, compositionArn }))) return;
  metrics.addMetric("RoundStarted", MetricUnit.Count, 1);
  await announce(round, "round_started", { startedAt });
}

async function cancelNoShow(round: Round) {
  if (!(await transitionRound(round.roundId, "ready", "cancelled", { cancelReason: "no_show" }))) return;
  metrics.addMetric("RoundCancelled", MetricUnit.Count, 1);
  await announce(round, "round_cancelled", { reason: "no_show" });
  await deleteStage(round.stageArn).catch((e) => logger.error("Stage cleanup failed", { roundId: round.roundId, error: (e as Error).message }));
  await deleteRoom(round.chatRoomArn).catch((e) => logger.error("Room cleanup failed", { roundId: round.roundId, error: (e as Error).message }));
}

/** T: ready rounds with both sides publishing go live; the rest are cancelled as no-shows. Idempotent. */
export async function startSlot(slotId: string) {
  for (const round of await roundsOf(slotId)) {
    if (round.status !== "ready") continue;
    try {
      if (await bothPublishing(round)) await goLive(round);
      else await cancelNoShow(round);
    } catch (e) {
      logger.error("Starting round failed", { slotId, roundId: round.roundId, error: (e as Error).message });
    }
  }
}

/** All SlotTick logic; later tasks add phases. */
export async function tick(now: number) {
  for (const slotId of slotsInWindow(now)) {
    try {
      if (Date.parse(slotId) - OPEN_BEFORE_MS <= now) await openSlot(slotId);
      if (Date.parse(slotId) <= now) await startSlot(slotId);
    } catch (e) {
      logger.error("Slot tick failed", { slotId, error: (e as Error).message });
    }
  }
}

// EventBridge Scheduler invokes this every minute during the slot hours.
export const handler = async (): Promise<void> => {
  try {
    await tick(Date.now());
  } finally {
    metrics.publishStoredMetrics();
  }
};

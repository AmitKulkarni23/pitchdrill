import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { listWaiting, markNoOpponent, pairWaiting } from "../bookings";
import { generateBriefs, fallbackBriefs, type Briefs } from "../briefs";
import { db, TABLE } from "../db";
import { createRoom, createStage, deleteRoom, deleteStage } from "../ivs";
import { roundPk } from "../keys";
import { logger, metrics } from "../observability";
import { roundsOf, type Round } from "./shared";

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

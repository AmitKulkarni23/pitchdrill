import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { deleteRoom, deleteStage, getActiveSessionId, listPublishingUserIds, startComposition } from "../ivs";
import { logger, metrics } from "../observability";
import { announce, roundsOf, transitionRound, type Round } from "./shared";

/** Both the seller and the buyer must be connected and publishing on the stage. */
export async function bothPublishing(round: Round): Promise<boolean> {
  const sessionId = await getActiveSessionId(round.stageArn);
  if (!sessionId) return false;
  const publishing = new Set(await listPublishingUserIds(round.stageArn, sessionId));
  return publishing.has(round.sellerBookingId) && publishing.has(round.buyerBookingId);
}

export async function goLive(round: Round, now: number) {
  const compositionArn = await startComposition(round.stageArn);
  const startedAt = new Date(now).toISOString();
  if (!(await transitionRound(round.roundId, "ready", "live", { startedAt, compositionArn }))) return;
  metrics.addMetric("RoundStarted", MetricUnit.Count, 1);
  await announce(round, "round_started", { startedAt });
}

/** ready -> cancelled: tell the room, then delete the stage and chat room. */
export async function cancelRound(round: Round, reason: "no_show" | "admin") {
  if (!(await transitionRound(round.roundId, "ready", "cancelled", { cancelReason: reason }))) return;
  metrics.addMetric("RoundCancelled", MetricUnit.Count, 1);
  await announce(round, "round_cancelled", { reason });
  await deleteStage(round.stageArn).catch((e) => logger.error("Stage cleanup failed", { roundId: round.roundId, error: (e as Error).message }));
  await deleteRoom(round.chatRoomArn).catch((e) => logger.error("Room cleanup failed", { roundId: round.roundId, error: (e as Error).message }));
}

/** T: ready rounds with both sides publishing go live; the rest are cancelled as no-shows. Idempotent. */
export async function startSlot(slotId: string, now = Date.now()) {
  for (const round of await roundsOf(slotId)) {
    if (round.status !== "ready") continue;
    try {
      if (await bothPublishing(round)) await goLive(round, now);
      else await cancelRound(round, "no_show");
    } catch (e) {
      logger.error("Starting round failed", { slotId, roundId: round.roundId, error: (e as Error).message });
    }
  }
}

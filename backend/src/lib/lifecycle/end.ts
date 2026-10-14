import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { db, TABLE } from "../db";
import { deleteRoom, deleteStage, stopComposition } from "../ivs";
import { roundPk } from "../keys";
import { logger, metrics } from "../observability";
import { findPlaylist } from "../recordings";
import { announce, getRound, MIN, roundsOf, transitionRound, type Round } from "./shared";

const ROUND_MS = 60_000;
const CLOSE_AFTER_MS = 15 * MIN;
const RECORDING_GRACE_MS = 20 * MIN;

/**
 * Buzzer: tell the room, stop recording, delete the stage, mark ended. Used by the 60s timer and by admins.
 * Idempotent: a round that is no longer live is left alone.
 */
export async function endRound(round: Round, endedBy?: "admin", now = Date.now()) {
  await announce(round, "buzzer", {});
  if (round.compositionArn) await stopComposition(round.compositionArn);
  await deleteStage(round.stageArn);
  const extra = { endedAt: new Date(now).toISOString(), ...(endedBy ? { endedBy } : {}) };
  if (!(await transitionRound(round.roundId, "live", "ended", extra))) return;
  metrics.addMetric("RoundEnded", MetricUnit.Count, 1);
}

export async function closeRound(round: Round) {
  await deleteRoom(round.chatRoomArn);
  await transitionRound(round.roundId, "ended", "closed");
}

/** Lists the recording into the replay feed once its playlist exists; flags it once if it never shows up. */
export async function registerRecording(round: Round, slotStart: number, now: number) {
  if (round.recordingPath || round.hidden || !round.compositionArn) return;
  const key = await findPlaylist(round.stageArn, round.compositionArn);
  if (key) {
    await db
      .send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: roundPk(round.roundId), SK: "META" },
          UpdateExpression: "SET recordingPath = :k, GSI1PK = :replay, GSI1SK = :ended",
          ConditionExpression: "attribute_not_exists(recordingPath)",
          ExpressionAttributeValues: { ":k": key, ":replay": "REPLAY", ":ended": round.endedAt },
        }),
      )
      .catch((e) => {
        if (!(e instanceof ConditionalCheckFailedException)) throw e;
      });
    return;
  }
  if (now < slotStart + RECORDING_GRACE_MS || round.recordingMissingAt) return;
  const flagged = await db
    .send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: roundPk(round.roundId), SK: "META" },
        UpdateExpression: "SET recordingMissingAt = :now",
        ConditionExpression: "attribute_not_exists(recordingMissingAt)",
        ExpressionAttributeValues: { ":now": new Date(now).toISOString() },
      }),
    )
    .then(() => true)
    .catch((e) => {
      if (e instanceof ConditionalCheckFailedException) return false;
      throw e;
    });
  if (flagged) {
    logger.warn("Recording missing", { roundId: round.roundId });
    metrics.addMetric("RecordingMissing", MetricUnit.Count, 1);
  }
}

/** Buzzer at startedAt + 60s, close chat at T + 15m, register recordings. Idempotent. */
export async function finishSlot(slotId: string, now: number) {
  const slotStart = Date.parse(slotId);
  for (const round of await roundsOf(slotId)) {
    try {
      let current = round;
      if (current.status === "live" && now >= Date.parse(current.startedAt) + ROUND_MS) {
        await endRound(current, undefined, now);
        current = (await getRound(current.roundId)) ?? current;
      }
      if (current.status === "ended" && now >= slotStart + CLOSE_AFTER_MS) {
        await closeRound(current);
        current = { ...current, status: "closed" };
      }
      if (current.status === "ended" || current.status === "closed") await registerRecording(current, slotStart, now);
    } catch (e) {
      logger.error("Finishing round failed", { slotId, roundId: round.roundId, error: (e as Error).message });
    }
  }
}

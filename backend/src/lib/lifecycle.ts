import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { sweepWaiters } from "./bookings";
import { fallbackBriefs, generateBriefs } from "./briefs";
import * as ivs from "./ivs";
import { logger, metrics } from "./observability";
import { ROUND_MS, roundsOfSlot, saveBriefs, transition, type RoundMeta } from "./rounds";
import { pacificDate, slotsForDate } from "./slots";

// Round lifecycle (docs/system_specs/architecture.md §4). Every step is a conditional transition, so ticks can repeat.
const MIN = 60_000;
const OPEN_BEFORE = 5 * MIN;
/** Participants get this long after T to start publishing before the round is cancelled as a no-show. */
const NO_SHOW_GRACE = MIN;
const CLOSE_AFTER = 15 * MIN;
const WINDOW_AFTER = 20 * MIN;
/** A tick ends rounds whose buzzer falls within this lead, waiting the rest, so rounds last exactly 2 min, not up to 3. */
const END_LEAD = 15_000;
/**
 * Ticks fire about once a minute, so the tick just before T waits for T, then polls the stage for up to START_POLL
 * and starts the round the moment both sides publish. START_POLL stays under the tick interval so polls never overlap.
 */
const START_LEAD = MIN;
const START_POLL = 50_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Slots whose round window (T-5m … T+20m) contains `now`. Includes the previous Pacific day for the UTC rollover. */
export function activeSlots(now: number): string[] {
  const dates = new Set([pacificDate(now - 86_400_000), pacificDate(now)]);
  return [...dates].flatMap(slotsForDate).filter((s) => {
    const t = Date.parse(s);
    return t - OPEN_BEFORE <= now && now <= t + WINDOW_AFTER;
  });
}

/** One SlotTick: moves every round of every active slot one step along its lifecycle. */
export async function tick(now: number): Promise<void> {
  const slots = activeSlots(now);
  if (slots.length) logger.info("Tick", { now: new Date(now).toISOString(), slots });
  await Promise.all(slots.map((slotId) => tickSlot(slotId, now).catch((e) => logger.error("Slot tick failed", { slotId, error: e as Error }))));
}

async function tickSlot(slotId: string, now: number) {
  const t = Date.parse(slotId);
  if (now <= t + NO_SHOW_GRACE) await sweepWaiters(slotId); // booking is closed by now; pair or release the leftovers
  const rounds = await roundsOfSlot(slotId);
  // Products already in this slot, so rounds running side by side never get the same canned brief.
  const products = new Set(rounds.flatMap((r) => (r.briefs ? [r.briefs.product.name] : [])));
  await Promise.all(
    rounds.map((r) => stepRound(r, t, now, products).catch((e) => logger.error("Round step failed", { roundId: r.roundId, status: r.status, error: e as Error }))),
  );
}

async function stepRound(r: RoundMeta, t: number, now: number, products: Set<string>) {
  switch (r.status) {
    case "paired":
      return openRound(r, products);
    case "ready":
      if (now >= t) return startOrCancel(r, t, now);
      if (t - now > START_LEAD) return;
      await sleep(t - now);
      return startOrCancel(r, t, t, now + START_POLL);
    case "live": {
      const endAt = Date.parse(r.startedAt!) + ROUND_MS;
      if (endAt - now > END_LEAD) return;
      if (endAt > now) await sleep(endAt - now);
      return endRound(r, Math.max(now, endAt));
    }
    case "ended":
      await checkRecording(r, t, now);
      if (now >= t + CLOSE_AFTER) await closeRound(r);
      return;
    case "closed":
      return checkRecording(r, t, now);
  }
}

/** T-5m: make sure briefs exist, then create the stage and chat room. */
async function openRound(r: RoundMeta, products: Set<string>) {
  if (!r.briefs) {
    let briefs;
    try {
      briefs = await generateBriefs();
      metrics.addMetric("BriefGenerated", MetricUnit.Count, 1);
    } catch (e) {
      logger.warn("Brief generation failed at open, using fallback", { roundId: r.roundId, error: (e as Error).message });
      briefs = fallbackBriefs(products); // picked and added in one synchronous step, so parallel rounds can't collide
      metrics.addMetric("BriefFallbackUsed", MetricUnit.Count, 1);
    }
    products.add(briefs.product.name);
    await saveBriefs(r.roundId, briefs);
  }
  const [stageArn, chatRoomArn] = await Promise.all([ivs.createStage(r.roundId), ivs.createRoom(r.roundId)]);
  if (await transition(r.roundId, "paired", { status: "ready", stageArn, chatRoomArn })) {
    logger.info("Round ready", { roundId: r.roundId, stageArn, chatRoomArn });
  } else {
    // A concurrent tick opened it first: drop the duplicates.
    await Promise.all([ivs.deleteStage(stageArn), ivs.deleteRoom(chatRoomArn)]);
  }
}

/**
 * T: both sides publishing → start recording and go live; still missing after the grace period → no-show.
 * With `pollUntil`, keeps checking until then (capped at the grace period) before giving up for this tick.
 */
async function startOrCancel(r: RoundMeta, t: number, now: number, pollUntil = 0) {
  const ids = [r.sellerBookingId, r.buyerBookingId];
  const publishing = await ivs.waitForPublishers(r.stageArn!, ids, Math.min(pollUntil, t + NO_SHOW_GRACE));
  now = Math.max(now, Date.now()); // polling took real time
  const present = { seller: publishing.includes(r.sellerBookingId), buyer: publishing.includes(r.buyerBookingId) };
  if (!present.seller || !present.buyer) {
    if (now >= t + NO_SHOW_GRACE) {
      logger.info("No-show", { roundId: r.roundId, ...present });
      await cancelRound(r, "no_show");
    }
    return;
  }
  const { compositionArn, recordingPrefix } = await ivs.startComposition(r.stageArn!, r.roundId);
  const startedAt = new Date(now).toISOString();
  if (!(await transition(r.roundId, "ready", { status: "live", startedAt, compositionArn, ...(recordingPrefix && { recordingPrefix }) }))) return;
  metrics.addMetric("RoundStarted", MetricUnit.Count, 1);
  logger.info("Round live", { roundId: r.roundId, compositionArn, recordingPrefix });
  await ivs.sendRoundEvent(r.chatRoomArn!, "round_started", { startedAt }).catch((e) => logger.warn("round_started event failed", { error: (e as Error).message }));
}

/** Cancels a ready round (no-show or admin) and removes its stage and room. */
export async function cancelRound(r: RoundMeta, reason: "no_show" | "admin") {
  if (!(await transition(r.roundId, "ready", { status: "cancelled", cancelReason: reason }))) return false;
  metrics.addMetric("RoundCancelled", MetricUnit.Count, 1);
  await ivs.sendRoundEvent(r.chatRoomArn!, "round_cancelled", { reason }).catch((e) => logger.warn("round_cancelled event failed", { error: (e as Error).message }));
  await Promise.all([ivs.deleteStage(r.stageArn!), ivs.deleteRoom(r.chatRoomArn!)]);
  logger.info("Round cancelled", { roundId: r.roundId, reason });
  return true;
}

/** Buzzer: stop recording, drop the stage, open voting. The chat room stays until T+15m for the tally. */
export async function endRound(r: RoundMeta, now = Date.now(), endedBy?: "admin") {
  await ivs.sendRoundEvent(r.chatRoomArn!, "buzzer", {}).catch((e) => logger.warn("buzzer event failed", { error: (e as Error).message }));
  if (r.compositionArn) await ivs.stopComposition(r.compositionArn);
  await ivs.deleteStage(r.stageArn!);
  const ok = await transition(r.roundId, "live", { status: "ended", endedAt: new Date(now).toISOString(), ...(endedBy && { endedBy }) });
  if (ok) logger.info("Round ended", { roundId: r.roundId, endedBy });
  return ok;
}

async function closeRound(r: RoundMeta) {
  await ivs.deleteRoom(r.chatRoomArn!);
  if (await transition(r.roundId, "ended", { status: "closed" })) logger.info("Round closed", { roundId: r.roundId });
}

/** Lists a finished recording in the replay feed once IVS has written recording-ended.json. */
async function checkRecording(r: RoundMeta, t: number, now: number) {
  if (r.recordingPath || r.hidden || !r.recordingPrefix) return;
  if (!(await ivs.recordingEnded(r.recordingPrefix))) {
    if (now >= t + WINDOW_AFTER - MIN && !r.recordingMissingLogged) {
      logger.warn("Recording missing", { roundId: r.roundId, recordingPrefix: r.recordingPrefix });
      metrics.addMetric("RecordingMissing", MetricUnit.Count, 1);
      await transition(r.roundId, r.status, { recordingMissingLogged: true });
    }
    return;
  }
  const recordingPath = `${r.recordingPrefix}/media/hls/multivariant.m3u8`;
  if (await transition(r.roundId, r.status, { recordingPath, GSI1PK: "REPLAY", GSI1SK: r.endedAt! })) logger.info("Replay registered", { roundId: r.roundId, recordingPath });
}

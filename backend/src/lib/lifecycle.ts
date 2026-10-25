import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { sweepWaiters } from "./bookings";
import { fallbackBriefs, generateBriefs } from "./briefs";
import * as ivs from "./ivs";
import { logger, metrics } from "./observability";
import { ROUND_MS, roundsOfSlot, saveBriefs, transition, type RoundMeta } from "./rounds";
import { pacificDate, slotsForDate } from "./slots";
import { measureVoices } from "./voices";

// Round lifecycle (docs/system_specs/architecture.md §4). Every step is a conditional transition, so ticks can repeat.
const MIN = 60_000;
/** T-5m: booking has closed; pair leftovers and make sure every round has briefs (revealed from here). */
const OPEN_BEFORE = 5 * MIN;
/** T-2m: create the stage and chat room. Later means fewer billed IVS minutes; earlier gives players time to join. */
const STAGE_BEFORE = 2 * MIN;
/** Participants get this long after T to start publishing before the round is cancelled as a no-show. */
const NO_SHOW_GRACE = MIN;
const CLOSE_AFTER = 15 * MIN;
const WINDOW_AFTER = 20 * MIN;
/**
 * A tick ends rounds whose buzzer falls within this lead, waiting the rest, so rounds last exactly 2 min. It must cover
 * the full tick interval (plus jitter): with less, a buzzer between two ticks waits for the next one. Overlapping ticks
 * are fine, endRound is a conditional transition. Lead + endRound stays under SlotTick's 90 s timeout.
 */
const END_LEAD = MIN + 10_000;
/**
 * Ticks fire about once a minute, so from the tick just before T each tick polls the stage for up to START_POLL (from T
 * at the earliest) and starts the round the moment both sides publish. START_POLL stays under the tick interval so
 * polls never overlap.
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
    case "paired": {
      await ensureBriefs(r, products);
      if (t - now > STAGE_BEFORE) return;
      const ready = await openRound(r);
      return ready ? stepReady(ready, t, now) : undefined; // this tick may be the one just before T
    }
    case "ready":
      return stepReady(r, t, now);
    case "live": {
      const endAt = Date.parse(r.startedAt!) + ROUND_MS;
      if (endAt - now > END_LEAD) return;
      if (endAt > now) await sleep(endAt - now);
      return endRound(r, Math.max(now, endAt));
    }
    case "ended":
      await checkRecording(r, t, now);
      await checkVoices(r);
      if (now >= t + CLOSE_AFTER) await closeRound(r);
      return;
    case "closed":
      await checkRecording(r, t, now);
      return checkVoices(r);
  }
}

/**
 * From T: start or cancel. Every tick from the one just before T polls (from T) until both players publish, so the
 * round starts within ~2 s of the second one joining, and a no-show is cancelled right at the grace deadline.
 */
async function stepReady(r: RoundMeta, t: number, now: number) {
  if (t - now > START_LEAD) return;
  if (now < t) await sleep(t - now);
  return startOrCancel(r, t, Math.max(now, t), now + START_POLL);
}

/** T-5m: briefs from OpenRouter, or a canned one when it fails, so a round never starts without them. */
async function ensureBriefs(r: RoundMeta, products: Set<string>) {
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
}

/** T-2m: create the stage and chat room. Returns the ready round, or null if a concurrent tick opened it first. */
async function openRound(r: RoundMeta): Promise<RoundMeta | null> {
  const [stageArn, chatRoomArn] = await Promise.all([ivs.createStage(r.roundId), ivs.createRoom(r.roundId)]);
  if (await transition(r.roundId, "paired", { status: "ready", stageArn, chatRoomArn })) {
    logger.info("Round ready", { roundId: r.roundId, stageArn, chatRoomArn });
    return { ...r, status: "ready", stageArn, chatRoomArn };
  }
  // A concurrent tick opened it first: drop the duplicates.
  await Promise.all([ivs.deleteStage(stageArn), ivs.deleteRoom(chatRoomArn)]);
  return null;
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
  // Before the stage goes: its sessions say where each player's individual recording is. Missing them only costs the meters.
  const voicePrefixes = await ivs
    .participantRecordingPrefixes(r.stageArn!, { seller: r.sellerBookingId, buyer: r.buyerBookingId })
    .catch((e) => void logger.warn("Couldn't list participant recordings", { roundId: r.roundId, error: (e as Error).message }));
  await ivs.deleteStage(r.stageArn!);
  const ok = await transition(r.roundId, "live", { status: "ended", endedAt: new Date(now).toISOString(), ...(endedBy && { endedBy }), ...(voicePrefixes && { voicePrefixes }) });
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

/** Once the replay is listed and every individual recording is final: save each side's speaking levels, then delete those recordings. */
async function checkVoices(r: RoundMeta) {
  const p = r.voicePrefixes;
  if (!p || r.voiceLevels || r.hidden || !r.recordingPath || (!p.seller.length && !p.buyer.length)) return;
  const voiceLevels = await measureVoices(r.recordingPrefix!, p);
  if (!voiceLevels || !(await transition(r.roundId, r.status, { voiceLevels }))) return;
  logger.info("Voice levels saved", { roundId: r.roundId });
  await Promise.all([...p.seller, ...p.buyer].map(ivs.deletePrefix));
}

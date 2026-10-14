import { logger, metrics } from "../lib/observability";
import { pacificDate, slotsForDate } from "../lib/slots";
import { finishSlot } from "../lib/lifecycle/end";
import { openSlot } from "../lib/lifecycle/open";
import { MIN } from "../lib/lifecycle/shared";
import { startSlot } from "../lib/lifecycle/start";

export { endRound, finishSlot } from "../lib/lifecycle/end";
export { openSlot } from "../lib/lifecycle/open";
export { startSlot } from "../lib/lifecycle/start";

const OPEN_BEFORE_MS = 5 * MIN;
const LOOKBACK_MS = 25 * MIN; // covers close (T+15m) and the missing-recording check (T+20m)

/** Slots whose start T satisfies now - 25m <= T <= now + 5m. */
export function slotsInWindow(now: number): string[] {
  const today = pacificDate(now);
  const yesterday = pacificDate(now - 24 * 60 * MIN);
  return [...slotsForDate(yesterday), ...slotsForDate(today)].filter((id) => {
    const t = Date.parse(id);
    return t >= now - LOOKBACK_MS && t <= now + OPEN_BEFORE_MS;
  });
}

/** All SlotTick logic; later tasks add phases. */
export async function tick(now: number) {
  for (const slotId of slotsInWindow(now)) {
    try {
      if (Date.parse(slotId) - OPEN_BEFORE_MS <= now) await openSlot(slotId);
      if (Date.parse(slotId) <= now) await startSlot(slotId, now);
      await finishSlot(slotId, now);
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

export const SLOT_TZ = "America/Los_Angeles";
const FIRST_MINUTE = 16 * 60; // 4:00 PM
const LAST_MINUTE = 20 * 60 + 45; // 8:45 PM
const STEP_MINUTES = 15;
// ponytail: extra test slots (12:40, 12:50, 1:00 PM) on one day only; delete after testing, with the SlotTick hours in backend-stack.ts.
const TEST_DATE = "2026-10-25";
const TEST_MINUTES = [12 * 60 + 40, 12 * 60 + 50, 13 * 60];

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SLOT_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SLOT_TZ }); // YYYY-MM-DD

/** Offset of SLOT_TZ from UTC, in ms, at the given instant. */
function tzOffset(utcMs: number): number {
  const p = Object.fromEntries(partsFormat.formatToParts(utcMs).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - utcMs;
}

/** Pacific calendar date (YYYY-MM-DD) of an instant. */
export function pacificDate(utcMs: number): string {
  return dateFormat.format(utcMs);
}

/**
 * UTC ISO start times of every slot on a Pacific date (YYYY-MM-DD).
 * DST switches at 2 AM, so the offset is the same all afternoon and one lookup is exact.
 */
export function slotsForDate(date: string): string[] {
  const [y, m, d] = date.split("-").map(Number);
  const slots: string[] = [];
  const minutes = date === TEST_DATE ? [...TEST_MINUTES] : [];
  for (let min = FIRST_MINUTE; min <= LAST_MINUTE; min += STEP_MINUTES) minutes.push(min);
  for (const min of minutes) {
    const wall = Date.UTC(y!, m! - 1, d!, 0, min);
    slots.push(new Date(wall - tzOffset(wall)).toISOString());
  }
  return slots;
}

export function isValidSlot(slotId: string): boolean {
  const ms = Date.parse(slotId);
  return !Number.isNaN(ms) && slotsForDate(pacificDate(ms)).includes(slotId);
}

const BOOKING_CLOSES_BEFORE_MS = 5 * 60_000;
const BOOKING_WINDOW_DAYS = 7;

/** Booking opens 7 days ahead and closes 5 minutes before the start. */
export function isBookable(slotId: string, now: number): boolean {
  const start = Date.parse(slotId);
  return now <= start - BOOKING_CLOSES_BEFORE_MS && start <= now + BOOKING_WINDOW_DAYS * 86_400_000;
}

/** Every slot that can be booked right now, soonest first. */
export function bookableSlots(now: number): string[] {
  const [y, m, d] = pacificDate(now).split("-").map(Number);
  const slots: string[] = [];
  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
    const date = new Date(Date.UTC(y!, m! - 1, d! + i)).toISOString().slice(0, 10);
    slots.push(...slotsForDate(date).filter((s) => isBookable(s, now)));
  }
  return slots;
}

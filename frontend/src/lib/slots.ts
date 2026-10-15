import type { SlotWithStats } from "@/types/api";

// ponytail: mirrors backend/src/lib/slots.ts so the guide still renders while the API is closed.
// Drop scheduleSlots() once GET /slots is public (TASK-021).
const SLOT_TZ = "America/Los_Angeles";
const FIRST_MINUTE = 16 * 60;
const LAST_MINUTE = 20 * 60 + 45;
const STEP_MINUTES = 15;
const CLOSES_BEFORE_MS = 5 * 60_000;
const WINDOW_DAYS = 7;
export const ROUND_SECONDS = 60;
/** Seats per role per slot; mirrors MAX_PER_ROLE in backend/src/lib/bookings.ts. */
export const MAX_PER_ROLE = 4;

const pacificParts = new Intl.DateTimeFormat("en-US", {
  timeZone: SLOT_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function tzOffset(utcMs: number): number {
  const p = Object.fromEntries(pacificParts.formatToParts(utcMs).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}

const localDate = (ms: number, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms);

/** Every bookable slot ID (UTC ISO) from now until 7 days ahead, soonest first. */
export function scheduleSlots(now: number): string[] {
  const [y, m, d] = localDate(now, SLOT_TZ).split("-").map(Number);
  const slots: string[] = [];
  for (let i = 0; i <= WINDOW_DAYS; i++) {
    for (let min = FIRST_MINUTE; min <= LAST_MINUTE; min += STEP_MINUTES) {
      const wall = Date.UTC(y, m - 1, d + i, 0, min);
      const start = wall - tzOffset(wall);
      if (now <= start - CLOSES_BEFORE_MS && start <= now + WINDOW_DAYS * 86_400_000) slots.push(new Date(start).toISOString());
    }
  }
  return slots;
}

export interface GuideDay<T> {
  dayKey: string;
  slots: T[];
}

/** Groups slots by the visitor's local calendar day, keeping order. */
export function groupSlotsByLocalDay<T extends { slotId: string }>(slots: T[], timeZone: string): GuideDay<T>[] {
  const days: GuideDay<T>[] = [];
  for (const slot of slots) {
    const dayKey = localDate(Date.parse(slot.slotId), timeZone);
    const last = days.at(-1);
    if (last?.dayKey === dayKey) last.slots.push(slot);
    else days.push({ dayKey, slots: [slot] });
  }
  return days;
}

export function dayLabel(dayKey: string, now: number, timeZone: string): string {
  const today = localDate(now, timeZone);
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (dayKey === today) return "Today";
  if (dayKey === tomorrow) return "Tomorrow";
  const [ky, km, kd] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    Date.UTC(ky, km - 1, kd),
  );
}

export const timeLabel = (slotId: string, timeZone: string): string =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(Date.parse(slotId));

type Stats = Omit<SlotWithStats, "slotId"> | null;

/** Seats left for one role; null stats (counts unavailable) means every seat is open. */
export const seatsLeft = (stats: Stats, role: "seller" | "buyer"): number =>
  Math.max(0, MAX_PER_ROLE - (stats ? (role === "seller" ? stats.sellers : stats.buyers) : 0));

/** "Seller 3 left · Buyer full", or "Full" when both sides are. */
export function seatsLabel(stats: Stats): string {
  if (isFull(stats)) return "Full";
  const side = (name: string, n: number) => `${name} ${n ? `${n} left` : "full"}`;
  return `${side("Seller", seatsLeft(stats, "seller"))} · ${side("Buyer", seatsLeft(stats, "buyer"))}`;
}

/** When someone is waiting, booking the other side guarantees a round. */
export function waitHint(stats: Stats): string | null {
  if (stats?.waitingSellers) return "A seller is waiting: book as buyer to play for sure";
  if (stats?.waitingBuyers) return "A buyer is waiting: book as seller to play for sure";
  return null;
}

/** "4:45 PM" today, "Tomorrow 4:45 PM" or "Thu, Oct 16 4:45 PM" otherwise. */
export function slotLabel(slotId: string, now: number, timeZone: string): string {
  const day = dayLabel(localDate(Date.parse(slotId), timeZone), now, timeZone);
  return day === "Today" ? timeLabel(slotId, timeZone) : `${day} ${timeLabel(slotId, timeZone)}`;
}

/** "27:04" or "2:14:30"; never negative. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const isFull = (stats: Omit<SlotWithStats, "slotId"> | null): boolean =>
  !!stats && stats.sellers >= MAX_PER_ROLE && stats.buyers >= MAX_PER_ROLE;

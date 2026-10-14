import type { Role, RoundStatus } from "@/types/api";
import { ROUND_SECONDS } from "./slots";

export type ArenaPhase = "pre-brief" | "brief" | "starting" | "live" | "buzzer" | "cancelled" | "ended";

export interface PhaseInput {
  now: number;
  /** Slot start T in ms. */
  slotStart: number;
  /** When the server started the round, in ms. */
  startedAt?: number;
  status: RoundStatus;
  /** The buzzer event arrived (or the timer ran out) on this client. */
  buzzed?: boolean;
}

export interface PhaseResult {
  phase: ArenaPhase;
  /** Whole seconds left in the round while live. */
  secondsLeft?: number;
  /** Milliseconds until the next phase boundary the UI counts down to (brief unlock or T). */
  untilMs?: number;
}

const BRIEF_BEFORE_MS = 30_000;

/** Pure timing logic for the arena; the component only renders what this says. */
export function arenaPhase({ now, slotStart, startedAt, status, buzzed }: PhaseInput): PhaseResult {
  if (status === "cancelled") return { phase: "cancelled" };
  if (status === "ended" || status === "closed") return { phase: "ended" };
  if (startedAt !== undefined) {
    const left = startedAt + ROUND_SECONDS * 1000 - now;
    if (buzzed || left <= 0) return { phase: "buzzer" };
    return { phase: "live", secondsLeft: Math.ceil(left / 1000) };
  }
  if (now < slotStart - BRIEF_BEFORE_MS) return { phase: "pre-brief", untilMs: slotStart - BRIEF_BEFORE_MS - now };
  if (now < slotStart) return { phase: "brief", untilMs: slotStart - now };
  return { phase: "starting" };
}

export type RoundEvent =
  | { kind: "round_started"; startedAt: number }
  | { kind: "buzzer" }
  | { kind: "round_cancelled"; reason: string }
  | { kind: "tally"; sold: number; notSold: number };

/** Turns an IVS Chat event into a typed round event; unknown or malformed events are ignored. */
export function parseRoundEvent(event: { eventName: string; attributes?: Record<string, string> }): RoundEvent | null {
  const a = event.attributes ?? {};
  switch (event.eventName) {
    case "round_started": {
      const startedAt = Date.parse(a.startedAt ?? "");
      return Number.isNaN(startedAt) ? null : { kind: "round_started", startedAt };
    }
    case "buzzer":
      return { kind: "buzzer" };
    case "round_cancelled":
      return { kind: "round_cancelled", reason: a.reason ?? "no_show" };
    case "tally": {
      const sold = Number(a.sold);
      const notSold = Number(a.notSold);
      return Number.isInteger(sold) && Number.isInteger(notSold) ? { kind: "tally", sold, notSold } : null;
    }
    default:
      return null;
  }
}

/** Seller on the left, buyer on the right. */
export const sideForRole = (role: Role): "left" | "right" => (role === "seller" ? "left" : "right");

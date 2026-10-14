import { expect, test } from "bun:test";
import { arenaPhase, parseRoundEvent, sideForRole } from "./arena";

const T = Date.parse("2026-10-15T00:00:00.000Z");

test("arenaPhase: before T-30s should be pre-brief", () => {
  expect(arenaPhase({ now: T - 60_000, slotStart: T, status: "ready" })).toEqual({ phase: "pre-brief", untilMs: 30_000 });
});
test("arenaPhase: between T-30s and start should be brief, then starting", () => {
  expect(arenaPhase({ now: T - 30_000, slotStart: T, status: "ready" })).toEqual({ phase: "brief", untilMs: 30_000 });
  expect(arenaPhase({ now: T - 1000, slotStart: T, status: "ready" }).phase).toBe("brief");
  expect(arenaPhase({ now: T + 2000, slotStart: T, status: "ready" }).phase).toBe("starting");
});
test("arenaPhase: live with startedAt 59s ago should be live with 1s left", () => {
  expect(arenaPhase({ now: T + 59_000, slotStart: T, startedAt: T, status: "live" })).toEqual({ phase: "live", secondsLeft: 1 });
  expect(arenaPhase({ now: T + 100, slotStart: T, startedAt: T, status: "live" })).toEqual({ phase: "live", secondsLeft: 60 });
});
test("arenaPhase: 60s after startedAt should be buzzer", () => {
  expect(arenaPhase({ now: T + 60_000, slotStart: T, startedAt: T, status: "live" }).phase).toBe("buzzer");
  expect(arenaPhase({ now: T + 10_000, slotStart: T, startedAt: T, status: "live", buzzed: true }).phase).toBe("buzzer");
});
test("arenaPhase: cancelled and ended statuses win", () => {
  expect(arenaPhase({ now: T, slotStart: T, status: "cancelled" }).phase).toBe("cancelled");
  expect(arenaPhase({ now: T, slotStart: T, startedAt: T, status: "ended" }).phase).toBe("ended");
  expect(arenaPhase({ now: T, slotStart: T, status: "closed" }).phase).toBe("ended");
});
test("parseRoundEvent: should parse round_started, buzzer, round_cancelled, tally", () => {
  expect(parseRoundEvent({ eventName: "round_started", attributes: { startedAt: "2026-10-15T00:00:00.000Z" } })).toEqual({ kind: "round_started", startedAt: T });
  expect(parseRoundEvent({ eventName: "buzzer" })).toEqual({ kind: "buzzer" });
  expect(parseRoundEvent({ eventName: "round_cancelled", attributes: { reason: "admin" } })).toEqual({ kind: "round_cancelled", reason: "admin" });
  expect(parseRoundEvent({ eventName: "tally", attributes: { sold: "12", notSold: "3" } })).toEqual({ kind: "tally", sold: 12, notSold: 3 });
});
test("parseRoundEvent: should ignore unknown or malformed events", () => {
  expect(parseRoundEvent({ eventName: "round_started", attributes: { startedAt: "nope" } })).toBeNull();
  expect(parseRoundEvent({ eventName: "tally", attributes: { sold: "x", notSold: "1" } })).toBeNull();
  expect(parseRoundEvent({ eventName: "other" })).toBeNull();
});
test("sideForRole: seller left, buyer right", () => {
  expect(sideForRole("seller")).toBe("left");
  expect(sideForRole("buyer")).toBe("right");
});

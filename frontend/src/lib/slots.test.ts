import { expect, test } from "bun:test";
import { countdown, dayLabel, groupSlotsByLocalDay, scheduleSlots, seatsLabel, slotLabel, timeLabel, waitHint } from "./slots";

const NOW = Date.parse("2026-10-14T23:30:00.000Z"); // Wed 4:30 PM PDT

test("scheduleSlots: should match the backend window (open 7 days ahead, close 5 min before)", () => {
  const slots = scheduleSlots(NOW);
  expect(slots[0]).toBe("2026-10-14T23:45:00.000Z");
  expect(slots.at(-1)).toBe("2026-10-21T23:30:00.000Z");
  expect(slots).toEqual([...slots].sort());
});

test("groupSlotsByLocalDay: should group by the visitor's local day", () => {
  const slots = ["2026-10-14T23:45:00.000Z", "2026-10-15T03:45:00.000Z"].map((slotId) => ({ slotId }));
  expect(groupSlotsByLocalDay(slots, "America/New_York").map((d) => d.dayKey)).toEqual(["2026-10-14"]);
  expect(groupSlotsByLocalDay(slots, "Asia/Kolkata").map((d) => d.dayKey)).toEqual(["2026-10-15"]);
  expect(groupSlotsByLocalDay(slots, "Europe/London").map((d) => d.dayKey)).toEqual(["2026-10-15"]);
});

test("dayLabel: should return Today / Tomorrow / weekday date", () => {
  expect(dayLabel("2026-10-14", NOW, "America/Los_Angeles")).toBe("Today");
  expect(dayLabel("2026-10-15", NOW, "America/Los_Angeles")).toBe("Tomorrow");
  expect(dayLabel("2026-10-17", NOW, "America/Los_Angeles")).toBe("Sat, Oct 17");
});

test("timeLabel: should format in the given time zone", () => {
  expect(timeLabel("2026-10-14T23:45:00.000Z", "America/Los_Angeles")).toBe("4:45 PM");
});

test("seatsLabel and waitHint: should describe seats left per side", () => {
  const stats = (sellers: number, buyers: number, waitingSellers: number, waitingBuyers: number) => ({ sellers, buyers, waitingSellers, waitingBuyers, rounds: Math.min(sellers, buyers) });
  expect(seatsLabel(null)).toBe("All seats open");
  expect(seatsLabel(stats(1, 3, 0, 2))).toBe("3 seller seats · 1 buyer seat open");
  expect(seatsLabel(stats(4, 2, 2, 0))).toBe("Seller seats full · 2 buyer seats open");
  expect(seatsLabel(stats(1, 4, 0, 3))).toBe("Buyer seats full · 3 seller seats open");
  expect(seatsLabel(stats(4, 4, 0, 0))).toBe("Full");
  expect(waitHint(null)).toBeNull();
  expect(waitHint(stats(3, 1, 2, 0))).toBe("A seller is waiting: book as buyer to play for sure");
  expect(waitHint(stats(1, 2, 0, 1))).toBe("A buyer is waiting: book as seller to play for sure");
});

test("slotLabel: should drop the day for today's slots", () => {
  expect(slotLabel("2026-10-14T23:45:00.000Z", NOW, "America/Los_Angeles")).toBe("4:45 PM");
  expect(slotLabel("2026-10-15T23:00:00.000Z", NOW, "America/Los_Angeles")).toBe("Tomorrow 4:00 PM");
});

test("countdown: should format m:ss, h:mm:ss and clamp at zero", () => {
  expect(countdown(27 * 60_000 + 4_000)).toBe("27:04");
  expect(countdown(2 * 3_600_000 + 14 * 60_000 + 30_000)).toBe("2:14:30");
  expect(countdown(-5_000)).toBe("0:00");
});

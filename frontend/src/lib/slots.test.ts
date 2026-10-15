import { expect, test } from "bun:test";
import { countdown, dayLabel, groupSlotsByLocalDay, scheduleSlots, slotLabel, timeLabel, waitingLabel } from "./slots";

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

test("waitingLabel: should describe counts and full seats", () => {
  const stats = (sellers: number, buyers: number, waitingSellers: number, waitingBuyers: number, rounds: number) => ({ sellers, buyers, waitingSellers, waitingBuyers, rounds });
  expect(waitingLabel(null)).toBe("Open");
  expect(waitingLabel(stats(1, 0, 1, 0, 0))).toBe("1 seller waiting for a buyer");
  expect(waitingLabel(stats(3, 1, 2, 0, 1))).toBe("2 sellers waiting for a buyer");
  expect(waitingLabel(stats(0, 1, 0, 1, 0))).toBe("1 buyer waiting for a seller");
  expect(waitingLabel(stats(3, 3, 0, 0, 3))).toBe("3 rounds booked · open");
  expect(waitingLabel(stats(4, 2, 2, 0, 2))).toBe("Seller seats full · buyers wanted");
  expect(waitingLabel(stats(4, 4, 0, 0, 4))).toBe("Full");
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

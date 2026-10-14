import { expect, test } from "bun:test";
import { dayLabel, groupSlotsByLocalDay, scheduleSlots, timeLabel, waitingLabel } from "./slots";

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

test("waitingLabel: should describe counts", () => {
  expect(waitingLabel(null)).toBe("Open");
  expect(waitingLabel({ waitingSellers: 1, waitingBuyers: 0, rounds: 0 })).toBe("1 seller waiting for a buyer");
  expect(waitingLabel({ waitingSellers: 2, waitingBuyers: 0, rounds: 1 })).toBe("2 sellers waiting for a buyer");
  expect(waitingLabel({ waitingSellers: 0, waitingBuyers: 1, rounds: 0 })).toBe("1 buyer waiting for a seller");
  expect(waitingLabel({ waitingSellers: 0, waitingBuyers: 0, rounds: 3 })).toBe("3 rounds booked · open");
});

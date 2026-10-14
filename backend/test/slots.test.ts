import { expect, test } from "bun:test";
import { bookableSlots, isBookable, isValidSlot, slotsForDate } from "../src/lib/slots";

test("20 slots, 4:00–8:45 PM Pacific, in PDT", () => {
  const slots = slotsForDate("2026-10-14");
  expect(slots).toHaveLength(20);
  expect(slots[0]).toBe("2026-10-14T23:00:00.000Z");
  expect(slots[1]).toBe("2026-10-14T23:15:00.000Z");
  expect(slots.at(-1)).toBe("2026-10-15T03:45:00.000Z");
});

test("follows PST in winter", () => {
  expect(slotsForDate("2026-12-14")[0]).toBe("2026-12-15T00:00:00.000Z");
});

test("isValidSlot", () => {
  expect(isValidSlot("2026-10-15T03:45:00.000Z")).toBe(true);
  expect(isValidSlot("2026-10-14T23:05:00.000Z")).toBe(false);
  expect(isValidSlot("2026-10-15T04:00:00.000Z")).toBe(false); // 9:00 PM
  expect(isValidSlot("garbage")).toBe(false);
});

test("booking closes 5 minutes before start and opens 7 days ahead", () => {
  const slot = "2026-10-14T23:00:00.000Z";
  const start = Date.parse(slot);
  expect(isBookable(slot, start - 5 * 60_000)).toBe(true);
  expect(isBookable(slot, start - 5 * 60_000 + 1)).toBe(false);
  expect(isBookable(slot, start - 7 * 86_400_000)).toBe(true);
  expect(isBookable(slot, start - 7 * 86_400_000 - 1)).toBe(false);
});

test("bookableSlots covers the next 7 days, soonest first", () => {
  const now = Date.parse("2026-10-14T23:30:00.000Z"); // Wed 4:30 PM PDT
  const slots = bookableSlots(now);
  expect(slots[0]).toBe("2026-10-14T23:45:00.000Z"); // 4:30 closed (starts now), 4:45 still open
  expect(slots.at(-1)).toBe("2026-10-21T23:30:00.000Z"); // exactly 7 days later
  expect(slots).toEqual([...slots].sort());
  expect(slots.every((s) => isBookable(s, now))).toBe(true);
});

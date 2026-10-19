import { expect, test } from "bun:test";
import { buildIcs } from "./ics";

const ics = buildIcs({
  slotId: "2026-10-14T23:45:00.000Z",
  role: "seller",
  link: "https://pitchdrill.app/t/abc",
  now: Date.parse("2026-10-13T00:00:00.000Z"),
});

test("buildIcs: should contain UTC DTSTART/DTEND, URL, VALARM -PT15M and CRLF", () => {
  expect(ics).toContain("DTSTART:20261014T234500Z\r\n");
  expect(ics).toContain("DTEND:20261015T000000Z\r\n");
  expect(ics).toContain("URL:https://pitchdrill.app/t/abc\r\n");
  expect(ics).toContain("TRIGGER:-PT15M");
  expect(ics.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
});

test("buildIcs: should escape commas, semicolons and newlines in text", () => {
  expect(ics).toContain("DESCRIPTION:Your ticket (keep it private): https://pitchdrill.app/t/abc\\nYour brief unlocks 5 minutes before the start\\; the arena opens 2 minutes before.");
  const odd = buildIcs({ slotId: "2026-10-14T23:45:00.000Z", role: "buyer", link: "https://x/t/a,b;c" });
  expect(odd).toContain("a\\,b\\;c");
});

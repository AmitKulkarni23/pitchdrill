import { expect, test } from "bun:test";
import { formatCountdown } from "./time";

test("formatCountdown: should format m:ss and h:mm:ss", () => {
  expect(formatCountdown(0)).toBe("0:00");
  expect(formatCountdown(59_999)).toBe("0:59");
  expect(formatCountdown(61_000)).toBe("1:01");
  expect(formatCountdown(3_600_000)).toBe("1:00:00");
  expect(formatCountdown(3_725_000)).toBe("1:02:05");
  expect(formatCountdown(-5000)).toBe("0:00");
});

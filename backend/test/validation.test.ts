import { describe, expect, test } from "bun:test";
import { requireNickname } from "../src/lib/validation";

describe("requireNickname", () => {
  test("should trim and accept valid nicknames", () => {
    expect(requireNickname({ nickname: "  Cool Cat_1.x-y  " })).toBe("Cool Cat_1.x-y");
  });
  test("should reject invalid characters and lengths", () => {
    for (const nickname of ["a", "x".repeat(21), "bad<script>", "emoji😀!", "", "   ", 42, undefined])
      expect(() => requireNickname({ nickname })).toThrow(expect.objectContaining({ status: 400, code: "bad_nickname" }));
  });
});

import { expect, test } from "bun:test";
import { isValidHandle } from "./validation";

test("isValidHandle: should match the backend rule", () => {
  for (const ok of ["amit", "Riya_2", "abc", "a".repeat(20)]) expect(isValidHandle(ok)).toBe(true);
  for (const bad of ["ab", "a b", "amit!", "a".repeat(21), ""]) expect(isValidHandle(bad)).toBe(false);
});

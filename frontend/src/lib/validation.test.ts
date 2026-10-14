import { expect, test } from "bun:test";
import { isValidHandle } from "./validation";

test("isValidHandle: should match the backend rule", () => {
  for (const ok of ["amit", "Riya_2", "abc", "a".repeat(20)]) expect(isValidHandle(ok)).toBe(true);
  for (const bad of ["ab", "a b", "amit!", "a".repeat(21), ""]) expect(isValidHandle(bad)).toBe(false);
});

import { isValidNickname } from "./validation";

test("isValidNickname: should match backend rule (trim, 2–20, allowed chars)", () => {
  expect(isValidNickname("  Fan 1  ")).toBe(true);
  expect(isValidNickname("a.b-c_d")).toBe(true);
  for (const bad of ["a", "   ", "x".repeat(21), "no<tags>", "emoji😀"]) expect(isValidNickname(bad)).toBe(false);
});

import { isValidComment, isValidReason } from "./validation";

test("isValidComment: should trim and enforce 1–500", () => {
  expect(isValidComment("  nice  ")).toBe(true);
  expect(isValidComment("x".repeat(500))).toBe(true);
  expect(isValidComment("x".repeat(501))).toBe(false);
  expect(isValidComment("   ")).toBe(false);
});

test("isValidReason: should trim and enforce 1–300", () => {
  expect(isValidReason("rude")).toBe(true);
  expect(isValidReason("x".repeat(301))).toBe(false);
  expect(isValidReason("")).toBe(false);
});

import { describe, expect, test } from "bun:test";
import { decodeCursor, encodeCursor } from "../src/lib/pagination";

describe("cursor", () => {
  test("round-trips a key", () => {
    const key = { PK: "ROUND#a", SK: "COMMENT#x" };
    expect(decodeCursor(encodeCursor(key))).toEqual(key);
    expect(decodeCursor(undefined)).toBeUndefined();
    expect(encodeCursor(undefined)).toBeUndefined();
  });
  test("given garbage, should throw bad_cursor", () => {
    const wrongKeys = Buffer.from(JSON.stringify({ evil: "x" })).toString("base64url");
    const nonString = Buffer.from(JSON.stringify({ PK: { $gt: 1 } })).toString("base64url");
    for (const c of ["%%%", "bm90LWpzb24", wrongKeys, nonString, Buffer.from("{}").toString("base64url")])
      expect(() => decodeCursor(c)).toThrow(expect.objectContaining({ status: 400, code: "bad_cursor" }));
  });
});

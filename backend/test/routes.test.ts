import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { routes } from "../src/routes";

describe("routes", () => {
  test("every handler name should have a file in src/handlers", () => {
    for (const r of routes) expect(existsSync(join(import.meta.dir, "../src/handlers", `${r.handler}.ts`))).toBe(true);
  });
  test("method + path pairs are unique", () => {
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  test("admin routes should all be auth iam, and nothing else", () => {
    for (const r of routes) expect(r.auth === "iam").toBe(r.path.startsWith("/admin/"));
    expect(routes.filter((r) => r.auth === "iam")).toHaveLength(3);
  });
});

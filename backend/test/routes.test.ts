import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { routes } from "../src/routes";
import { matchRoute, toEvent } from "../src/dev/server";

test("every route handler has a file in src/handlers", () => {
  for (const r of routes) expect(existsSync(`${import.meta.dir}/../src/handlers/${r.handler}.ts`)).toBe(true);
});

test("admin routes are IAM-only, everything else public", () => {
  for (const r of routes) expect(r.auth).toBe(r.path.startsWith("/admin/") ? "iam" : "public");
});

test("matchRoute: path params, literal routes before params, misses", () => {
  expect(matchRoute("GET", "/rounds/abc")).toMatchObject({ route: { handler: "getRound" }, params: { roundId: "abc" } });
  expect(matchRoute("GET", "/rounds/live")?.route.handler).toBe("listLiveRounds");
  expect(matchRoute("POST", "/rounds/abc/votes")?.route.handler).toBe("castVote");
  expect(matchRoute("DELETE", "/slots")).toBeUndefined();
  expect(matchRoute("GET", "/nope")).toBeUndefined();
});

test("toEvent: lowercases headers and parses the query string", async () => {
  const m = matchRoute("GET", "/replays")!;
  const e = await toEvent(new Request("http://x/replays?cursor=abc", { headers: { "X-Ticket": "t" } }), m.route, m.params);
  expect(e.headers["x-ticket"]).toBe("t");
  expect(e.queryStringParameters).toEqual({ cursor: "abc" });
  expect(e.routeKey).toBe("GET /replays");
});

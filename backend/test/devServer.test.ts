import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { matchRoute, startServer, toEvent } from "../src/dev/server";
import { createLocalTable } from "../src/dev/localTable";

describe("matchRoute", () => {
  test("given /ticket, should match the registry route", () => {
    expect(matchRoute("GET", "/ticket")?.route.handler).toBe("getTicket");
  });
  test("given unknown path or wrong method, should return undefined", () => {
    expect(matchRoute("GET", "/nope")).toBeUndefined();
    expect(matchRoute("POST", "/slots")).toBeUndefined();
  });
});

describe("toEvent", () => {
  test("should lowercase headers and parse query string", async () => {
    const req = new Request("http://localhost:4000/slots?a=1&b=two", { headers: { "X-Ticket": "t", "Content-Type": "application/json" } });
    const e = await toEvent(req, { roundId: "abc" });
    expect(e.headers).toMatchObject({ "x-ticket": "t", "content-type": "application/json" });
    expect(e.queryStringParameters).toEqual({ a: "1", b: "two" });
    expect(e.pathParameters).toEqual({ roundId: "abc" });
    expect(e.rawPath).toBe("/slots");
    expect(e.requestContext.http.method).toBe("GET");
  });
  test("should pass the body of POST requests", async () => {
    const e = await toEvent(new Request("http://localhost:4000/bookings", { method: "POST", body: '{"x":1}' }));
    expect(e.body).toBe('{"x":1}');
  });
});

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("dev server", () => {
  const runTick = mock(async (_now: number) => {});
  const server = startServer(0, runTick);
  const base = `http://localhost:${server.port}`;
  beforeAll(createLocalTable);
  afterAll(() => server.stop(true));

  test("GET /slots should return 200 with CORS header for localhost:3000", async () => {
    const res = await fetch(`${base}/slots`);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(((await res.json()) as any).slots.length).toBeGreaterThan(0);
  });
  test("OPTIONS preflight should return 204 with allowed headers", async () => {
    const res = await fetch(`${base}/bookings`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type,x-ticket");
  });
  test("POST /dev/tick should call tick with the given time", async () => {
    const res = await fetch(`${base}/dev/tick?now=2099-02-01T23:55:00.000Z`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(runTick).toHaveBeenCalledWith(Date.parse("2099-02-01T23:55:00.000Z"));
  });
  test("unknown route should return 404 not_found", async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error.code).toBe("not_found");
  });
});

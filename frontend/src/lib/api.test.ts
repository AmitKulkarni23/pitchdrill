import { afterEach, expect, spyOn, test } from "bun:test";

process.env.NEXT_PUBLIC_API_URL = "https://api.test/";
const { api, ApiError } = await import("./api");

const respond = (status: number, body: unknown) =>
  spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.());

test("api.get: given { error } response, should throw ApiError with code and status", async () => {
  respond(409, { error: { code: "handle_taken", message: "Taken." } });
  const err = await api.get("/x").catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 409, code: "handle_taken", message: "Taken." });
});

test("api.get: given ticket, should send x-ticket header to the trimmed base URL", async () => {
  const fetch = respond(200, { ok: true });
  await api.get("/ticket", { ticket: "abc" });
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://api.test/ticket");
  expect((init.headers as Record<string, string>)["x-ticket"]).toBe("abc");
});

test("api.post: given fetch rejection, should throw ApiError network", async () => {
  spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  expect(api.post("/bookings", {})).rejects.toMatchObject({ code: "network", status: 0 });
});

test("api.post: given API Gateway 403 without our shape, should throw not_open", async () => {
  respond(403, { message: "Forbidden" });
  expect(api.post("/bookings", {})).rejects.toMatchObject({ code: "not_open" });
});

test("api.get: error details beyond code/message are kept", async () => {
  respond(403, { error: { code: "brief_not_yet", message: "Not yet.", availableAt: "2026-01-01T00:00:00.000Z" } });
  expect(api.get("/x")).rejects.toMatchObject({ details: { availableAt: "2026-01-01T00:00:00.000Z" } });
});

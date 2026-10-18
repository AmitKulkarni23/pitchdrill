import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";

import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const secretSpy = () => spyOn(SecretsManagerClient.prototype, "send").mockResolvedValue({ SecretString: "sk-test" } as never);
process.env.OPENROUTER_MODEL_ENV = "test/model";
const { fallbackBriefs, generateBriefs, parseBriefs } = await import("../src/lib/briefs");
const { FALLBACK_BRIEFS } = await import("../src/lib/fallbackBriefs");

const good = { product: { name: "Widget", price: "$10", tagline: "It widgets" }, seller: ["It widgets.", "$10, once."], buyer: ["You are skeptical.", "Budget: $5."] };
const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));
beforeEach(secretSpy);
afterEach(() => mock.restore());

test("valid response → briefs with source openrouter; sends model and bearer key", async () => {
  const f = spyOn(globalThis, "fetch").mockResolvedValue(reply("```json\n" + JSON.stringify(good) + "\n```"));
  expect(await generateBriefs()).toEqual({ ...good, source: "openrouter" });
  const [, init] = f.mock.calls[0]!;
  expect(JSON.parse(String(init!.body)).model).toBe("test/model");
  expect((init!.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
});

test("invalid then valid → retries once", async () => {
  const f = spyOn(globalThis, "fetch").mockResolvedValueOnce(reply("not json")).mockResolvedValueOnce(reply(JSON.stringify(good)));
  expect((await generateBriefs()).product.name).toBe("Widget");
  expect(f).toHaveBeenCalledTimes(2);
});

test("two failures → throws", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
  expect(generateBriefs()).rejects.toThrow();
});

test("parseBriefs rejects missing fields; fallback list is complete", () => {
  expect(parseBriefs(JSON.stringify({ ...good, buyer: [] }))).toBeNull();
  expect(parseBriefs(JSON.stringify({ ...good, seller: "One paragraph." }))).toBeNull();
  expect(FALLBACK_BRIEFS.length).toBeGreaterThanOrEqual(10);
  for (const b of FALLBACK_BRIEFS) expect(parseBriefs(JSON.stringify(b))).not.toBeNull();
  expect(fallbackBriefs().source).toBe("fallback");
});

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

mock.module("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = async () => ({ SecretString: "sk-test-key" });
  },
  GetSecretValueCommand: class {},
}));

const { generateBriefs, fallbackBriefs } = await import("../src/lib/briefs");
const { FALLBACK_COUNT } = await import("../src/lib/fallbackBriefs");

const good = { product: { name: "Widget", price: "$10", tagline: "A widget." }, seller: "Sell it.", buyer: "Buy it?" };
const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

let fetchSpy: ReturnType<typeof spyOn>;
beforeEach(() => {
  process.env.OPENROUTER_MODEL_ENV = "test/model";
  fetchSpy = spyOn(globalThis, "fetch");
});
afterEach(() => fetchSpy.mockRestore());

describe("generateBriefs", () => {
  test("given a valid response, should return briefs with source openrouter", async () => {
    fetchSpy.mockResolvedValueOnce(reply(JSON.stringify(good)));
    expect(await generateBriefs()).toEqual({ ...good, source: "openrouter" });
  });

  test("given code fences, should still parse", async () => {
    fetchSpy.mockResolvedValueOnce(reply("```json\n" + JSON.stringify(good) + "\n```"));
    expect((await generateBriefs()).product.name).toBe("Widget");
  });

  test("should send model and bearer key", async () => {
    fetchSpy.mockResolvedValueOnce(reply(JSON.stringify(good)));
    await generateBriefs();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("test/model");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("given invalid JSON then valid, should retry once and succeed", async () => {
    fetchSpy.mockResolvedValueOnce(reply("not json")).mockResolvedValueOnce(reply(JSON.stringify(good)));
    expect((await generateBriefs()).source).toBe("openrouter");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("given two failures, should throw", async () => {
    fetchSpy.mockResolvedValueOnce(reply("{}")).mockResolvedValueOnce(new Response("no", { status: 500 }));
    expect(generateBriefs()).rejects.toThrow();
  });
});

describe("fallbackBriefs", () => {
  test("should have at least 10 complete entries with source fallback", () => {
    expect(FALLBACK_COUNT).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < 30; i++) {
      const b = fallbackBriefs();
      expect(b.source).toBe("fallback");
      expect(b.product.name && b.product.price && b.product.tagline && b.seller && b.buyer).toBeTruthy();
    }
  });
});

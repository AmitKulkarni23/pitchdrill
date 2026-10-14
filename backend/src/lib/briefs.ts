import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { logger } from "./observability";

export interface Briefs {
  product: { name: string; price: string; tagline: string };
  seller: string;
  buyer: string;
  source: "openrouter" | "fallback";
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 20_000;
const ATTEMPTS = 2;

const PROMPT = `Invent one random, safe-for-work, plausible product (consumer or B2B) for a one-minute sales role-play.
Reply with JSON only, in exactly this shape:
{"product":{"name":"...","price":"...","tagline":"..."},"seller":"...","buyer":"..."}
- "seller": a product sheet for the seller, at most 120 words: what it is, key benefits, price, terms.
- "buyer": a hidden persona for the buyer, at most 120 words: who they are, their budget, their current solution, 2-3 objections, and what could change their mind.`;

const secrets = new SecretsManagerClient({});
let cachedKey: string | undefined;

async function apiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { SecretString } = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.OPENROUTER_SECRET_ARN_ENV }));
  if (!SecretString) throw new Error("OpenRouter secret is empty");
  return (cachedKey = SecretString);
}

const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** Strips code fences some models add, parses, and validates the shape. Throws on anything unexpected. */
function parseBriefs(content: string): Briefs {
  const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const o = JSON.parse(json);
  const p = o?.product;
  if (!text(p?.name, 80) || !text(p?.price, 40) || !text(p?.tagline, 160) || !text(o.seller, 1200) || !text(o.buyer, 1200))
    throw new Error("Brief response failed validation");
  return {
    product: { name: p.name.trim(), price: p.price.trim(), tagline: p.tagline.trim() },
    seller: o.seller.trim(),
    buyer: o.buyer.trim(),
    source: "openrouter",
  };
}

/** Asks OpenRouter for a product sheet and buyer persona; retries once, then throws. */
export async function generateBriefs(): Promise<Briefs> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${await apiKey()}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL_ENV,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: PROMPT }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return parseBriefs(data.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      lastError = e;
      // Never log the key; the error message holds only status or parse details.
      logger.warn("Brief generation attempt failed", { attempt, error: (e as Error).message });
    }
  }
  throw lastError;
}

export { fallbackBriefs } from "./fallbackBriefs";

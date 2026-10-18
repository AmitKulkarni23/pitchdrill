import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { logger, tracer } from "./observability";
import { FALLBACK_BRIEFS } from "./fallbackBriefs";

export interface Product {
  name: string;
  price: string;
  tagline: string;
}
export interface Briefs {
  product: Product;
  /** Seller's product sheet. */
  seller: string;
  /** Buyer's hidden persona. Never shown to the seller. */
  buyer: string;
  source: "openrouter" | "fallback";
}

const secrets = tracer.captureAWSv3Client(new SecretsManagerClient({}));
let apiKey: string | undefined; // cached per container; never logged

async function getApiKey(): Promise<string> {
  apiKey ??= (await secrets.send(new GetSecretValueCommand({ SecretId: process.env.OPENROUTER_SECRET_ARN_ENV }))).SecretString;
  if (!apiKey || apiKey === "set-me") throw new Error("OpenRouter API key is not set in Secrets Manager");
  return apiKey;
}

const PROMPT = `You write material for a two-minute sales role-play game.
Invent ONE random, plausible, safe-for-work product (consumer or B2B; vary the category widely).
Return ONLY a JSON object with exactly these fields:
{
  "product": { "name": string (max 60 chars), "price": string (e.g. "$49/month"), "tagline": string (max 100 chars) },
  "seller": string — a product sheet for the seller, max 120 words: what it is, who it is for, 3 key benefits, price and one proof point,
  "buyer": string — a hidden persona for the buyer, max 120 words, second person ("You are..."): who they are, budget, current solution, 2–3 objections, and what could change their mind
}`;

const str = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** Validates the model output; returns null when anything is missing or out of bounds. */
export function parseBriefs(content: string): Briefs | null {
  try {
    const o = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    const p = o?.product;
    if (!str(p?.name, 80) || !str(p?.price, 40) || !str(p?.tagline, 160) || !str(o.seller, 1200) || !str(o.buyer, 1200)) return null;
    return { product: { name: p.name.trim(), price: p.price.trim(), tagline: p.tagline.trim() }, seller: o.seller.trim(), buyer: o.buyer.trim(), source: "openrouter" };
  } catch {
    return null;
  }
}

async function attempt(): Promise<Briefs> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${await getApiKey()}`, "content-type": "application/json", "x-title": "PitchDrill" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL_ENV,
      response_format: { type: "json_object" },
      temperature: 1,
      max_tokens: 800,
      messages: [{ role: "user", content: PROMPT }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const briefs = parseBriefs(data.choices?.[0]?.message?.content ?? "");
  if (!briefs) throw new Error("OpenRouter returned an invalid brief");
  return briefs;
}

/** One random product with a seller sheet and a hidden buyer persona. Retries once, then throws. */
export async function generateBriefs(): Promise<Briefs> {
  try {
    return await attempt();
  } catch (e) {
    logger.warn("Brief generation attempt failed, retrying", { error: (e as Error).message });
    return attempt();
  }
}

export const fallbackBriefs = (): Briefs => ({ ...FALLBACK_BRIEFS[Math.floor(Math.random() * FALLBACK_BRIEFS.length)]!, source: "fallback" });

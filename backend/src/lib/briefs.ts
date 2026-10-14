// Phase 2: product briefs (seller) and hidden personas (buyer) generated via OpenRouter.
// The API key will live in Secrets Manager and be read here; nothing calls this yet.

export interface Briefs {
  seller: string;
  buyer: string;
}

export async function generateBriefs(): Promise<Briefs> {
  throw new Error("generateBriefs is not implemented yet (OpenRouter, phase 2)");
}

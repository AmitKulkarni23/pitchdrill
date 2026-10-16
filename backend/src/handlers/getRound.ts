import { handle, json } from "../lib/http";
import { requireRound, toPublicRound } from "../lib/rounds";
import { requireRoundId } from "../lib/validation";

// GET /rounds/{roundId} → { round } (public fields only; 404 for hidden rounds)
export const handler = handle(async (event) => json(200, { round: toPublicRound(await requireRound(requireRoundId(event))) }));

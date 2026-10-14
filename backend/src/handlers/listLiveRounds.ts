import { handle, json } from "../lib/http";
import { liveRounds } from "../lib/rounds";

// GET /rounds/live → { rounds } ready/live rounds of the current slot
export const handler = handle(async () => json(200, { rounds: await liveRounds(Date.now()) }));

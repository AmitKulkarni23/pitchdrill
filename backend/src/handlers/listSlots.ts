import { handle, json } from "../lib/http";
import { slotsWithStats } from "../lib/slotStats";

// GET /slots → { slots: [{ slotId, sellers, buyers, waitingSellers, waitingBuyers, rounds }] }, soonest first.
export const handler = handle(async () => json(200, { slots: await slotsWithStats(Date.now()) }));

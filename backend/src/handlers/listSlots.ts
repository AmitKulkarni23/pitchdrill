import { handle, json } from "../lib/http";
import { slotsWithStats } from "../lib/slotStats";

// GET /slots → { slots: [{ slotId, waitingSellers, waitingBuyers, rounds }] } — every slot bookable right now (next 7 days), soonest first.
export const handler = handle(async () => json(200, { slots: await slotsWithStats(Date.now()) }));

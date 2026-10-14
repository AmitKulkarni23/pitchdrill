import { handle, json } from "../lib/http";
import { bookableSlots } from "../lib/slots";

// GET /slots → { slots: [utcIso] } — every slot bookable right now (next 7 days), soonest first.
export const handler = handle(async () => json(200, { slots: bookableSlots(Date.now()) }));

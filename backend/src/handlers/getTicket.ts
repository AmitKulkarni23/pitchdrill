import { getBookingByTicket } from "../lib/bookings";
import { handle, json } from "../lib/http";

// GET /ticket with header `x-ticket` (kept out of the URL so it never lands in access logs) → { booking }
export const handler = handle(async (event) => json(200, { booking: await getBookingByTicket(event.headers["x-ticket"]) }));

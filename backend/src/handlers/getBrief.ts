import { getBookingByTicket } from "../lib/bookings";
import { handle, json, UserError } from "../lib/http";
import { requireRound } from "../lib/rounds";
import { requireRoundId } from "../lib/validation";

const REVEAL_BEFORE_MS = 30_000;

// GET /rounds/{roundId}/brief (x-ticket) → { role, product, brief } for the ticket holder's side only, from T-30s.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const booking = await getBookingByTicket(event.headers["x-ticket"]);
  const round = await requireRound(roundId);
  const role = booking.bookingId === round.sellerBookingId ? "seller" : booking.bookingId === round.buyerBookingId ? "buyer" : null;
  if (!role) throw new UserError(403, "not_your_round", "This ticket isn't for that round.");
  const availableAt = Date.parse(round.slotId) - REVEAL_BEFORE_MS;
  if (Date.now() < availableAt)
    throw new UserError(403, "brief_not_yet", "Your brief unlocks 30 seconds before the round.", { availableAt: new Date(availableAt).toISOString() });
  if (!round.briefs) throw new UserError(503, "brief_pending", "Your brief is still being written. Try again in a few seconds.");
  return json(200, { role, product: round.briefs.product, brief: round.briefs[role] });
});

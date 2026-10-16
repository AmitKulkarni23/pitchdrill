import { getBookingByTicket } from "../lib/bookings";
import { handle, json, UserError } from "../lib/http";
import { chatToken, stageToken } from "../lib/ivs";
import { logger } from "../lib/observability";
import { requireRound, toPublicRound } from "../lib/rounds";
import { requireRoundId } from "../lib/validation";

// POST /rounds/{roundId}/join (x-ticket) → { stageToken (PUBLISH+SUBSCRIBE), chatToken (receive only), role, round }
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const booking = await getBookingByTicket(event.headers["x-ticket"]);
  const round = await requireRound(roundId);
  const role = booking.bookingId === round.sellerBookingId ? "seller" : booking.bookingId === round.buyerBookingId ? "buyer" : null;
  if (!role) throw new UserError(403, "not_your_round", "This ticket isn't for that round.");
  if (round.status !== "ready" && round.status !== "live")
    throw new UserError(409, "round_not_joinable", "This round isn't open to join.", { status: round.status });
  // userId = bookingId is what SlotTick checks with ListParticipants to decide whether both sides showed up.
  const [stage, chat] = await Promise.all([
    stageToken(round.stageArn!, booking.bookingId, { handle: booking.handle, role, order: role === "seller" ? "1" : "2" }, true),
    chatToken(round.chatRoomArn!, booking.bookingId, { nickname: booking.handle, role }, false, 30),
  ]);
  logger.info("Participant joined", { roundId, role });
  return json(200, { role, stageToken: stage.token, chatToken: chat, round: toPublicRound(round) });
});

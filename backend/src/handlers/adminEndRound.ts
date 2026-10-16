import { handle, json, UserError } from "../lib/http";
import { cancelRound, endRound } from "../lib/lifecycle";
import { getRound, toPublicRound } from "../lib/rounds";
import { requireRoundId } from "../lib/validation";

// POST /admin/rounds/{roundId}/end (IAM): live → ended now; ready → cancelled (admin).
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const round = await getRound(roundId);
  if (!round) throw new UserError(404, "round_not_found", "That round doesn't exist.");
  if (round.status === "live") await endRound(round, Date.now(), "admin");
  else if (round.status === "ready") await cancelRound(round, "admin");
  else throw new UserError(409, "round_not_active", "Only ready or live rounds can be ended.", { status: round.status });
  return json(200, { round: toPublicRound((await getRound(roundId))!) });
});

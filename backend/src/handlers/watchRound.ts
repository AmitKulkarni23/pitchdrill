import { handle, json, UserError } from "../lib/http";
import { stageToken } from "../lib/ivs";
import { requireRound } from "../lib/rounds";
import { readBody, requireRoundId, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/watch { voterId } → { stageToken } (SUBSCRIBE only) while the round is ready or live.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const voterId = requireVoterId(readBody(event).voterId);
  const round = await requireRound(roundId);
  if (round.status !== "ready" && round.status !== "live") throw new UserError(409, "round_not_live", "This round isn't live.", { status: round.status });
  const { token } = await stageToken(round.stageArn!, `viewer-${voterId}`, {}, false);
  return json(200, { stageToken: token });
});

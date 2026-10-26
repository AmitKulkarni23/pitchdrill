import { handle, json, UserError } from "../lib/http";
import { chatToken } from "../lib/ivs";
import { requireRound } from "../lib/rounds";
import { readBody, requireNickname, requireRoundId, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/chat-token { voterId, nickname } → { token, sessionExpirationTime, tokenExpirationTime }
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const body = readBody(event);
  const voterId = requireVoterId(body.voterId);
  const nickname = requireNickname(body.nickname);
  const round = await requireRound(roundId);
  if (!["ready", "live", "ended"].includes(round.status) || !round.chatRoomArn) throw new UserError(409, "chat_closed", "Chat for this round is closed.");
  const lower = nickname.toLowerCase();
  if (lower === round.sellerHandle.toLowerCase() || lower === round.buyerHandle.toLowerCase())
    throw new UserError(409, "nickname_taken", "That nickname belongs to a player in this round. Pick another.");
  return json(200, await chatToken(round.chatRoomArn, `viewer-${voterId}`, { nickname, roundId }, true, 60));
});

import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "../lib/db";
import { handle, json, UserError } from "../lib/http";
import { requireRound } from "../lib/rounds";
import { readBody, requireNickname, requireRoundId, requireText, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/comments { voterId, nickname, text } → 201 { comment }, after the round ends.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const body = readBody(event);
  const voterId = requireVoterId(body.voterId);
  const nickname = requireNickname(body.nickname);
  const text = requireText(body.text, 500, "bad_text", "Comments");
  const round = await requireRound(roundId);
  if (round.status !== "ended" && round.status !== "closed") throw new UserError(409, "comments_closed", "Comments open when the round ends.");
  const lower = nickname.toLowerCase();
  if (lower === round.sellerHandle.toLowerCase() || lower === round.buyerHandle.toLowerCase())
    throw new UserError(409, "nickname_taken", "That nickname belongs to a player in this round. Pick another.");
  const comment = { commentId: randomUUID(), nickname, text, createdAt: new Date().toISOString() };
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `ROUND#${roundId}`, SK: `COMMENT#${comment.createdAt}#${comment.commentId}`, voterId, ...comment } }));
  return json(201, { comment });
});

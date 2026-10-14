import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createComment, requireCommentText } from "../lib/comments";
import { handle, json } from "../lib/http";
import { parseBody, requireNickname, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/comments { voterId, nickname, text } → 201 { comment }
export const handler = handle(async (event: APIGatewayProxyEventV2) => {
  const body = parseBody(event);
  const comment = await createComment(event.pathParameters!.roundId!, requireVoterId(body), requireNickname(body), requireCommentText(body));
  return json(201, { comment });
});

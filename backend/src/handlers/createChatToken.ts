import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { spectatorChatToken } from "../lib/rounds";
import { parseBody, requireNickname, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/chat-token { voterId, nickname } → { token, sessionExpirationTime, tokenExpirationTime }
export const handler = handle(async (event: APIGatewayProxyEventV2) => {
  const body = parseBody(event);
  return json(200, await spectatorChatToken(event.pathParameters!.roundId!, requireVoterId(body), requireNickname(body)));
});

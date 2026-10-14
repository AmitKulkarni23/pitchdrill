import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { castVote, requireVote } from "../lib/votes";
import { parseBody, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/votes { voterId, vote } → { votesSold, votesNotSold }
export const handler = handle(async (event: APIGatewayProxyEventV2) => {
  const body = parseBody(event);
  return json(200, await castVote(event.pathParameters!.roundId!, requireVoterId(body), requireVote(body)));
});

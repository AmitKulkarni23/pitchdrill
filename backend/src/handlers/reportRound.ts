import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { reportRound, requireReason } from "../lib/reports";
import { parseBody, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/reports { voterId, reason } → 201 { reported: true }
export const handler = handle(async (event: APIGatewayProxyEventV2) => {
  const body = parseBody(event);
  return json(201, await reportRound(event.pathParameters!.roundId!, requireVoterId(body), requireReason(body)));
});

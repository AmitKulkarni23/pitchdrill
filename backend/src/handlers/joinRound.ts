import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { joinRound } from "../lib/rounds";

// POST /rounds/{roundId}/join with header `x-ticket` → { stageToken, chatToken }
export const handler = handle(async (event: APIGatewayProxyEventV2) =>
  json(200, await joinRound(event.headers["x-ticket"], event.pathParameters!.roundId!)),
);

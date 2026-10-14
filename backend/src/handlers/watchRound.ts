import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { watchRound } from "../lib/rounds";
import { parseBody, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/watch { voterId } → { stageToken } (subscribe only)
export const handler = handle(async (event: APIGatewayProxyEventV2) =>
  json(200, await watchRound(event.pathParameters!.roundId!, requireVoterId(parseBody(event)))),
);

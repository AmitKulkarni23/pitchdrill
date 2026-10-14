import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { getRoundMeta, toPublicRound } from "../lib/rounds";

// GET /rounds/{roundId} → { round } (public shape, no briefs)
export const handler = handle(async (event: APIGatewayProxyEventV2) =>
  json(200, { round: toPublicRound(await getRoundMeta(event.pathParameters!.roundId!)) }),
);

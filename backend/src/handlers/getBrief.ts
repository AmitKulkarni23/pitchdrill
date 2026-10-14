import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { getBrief } from "../lib/rounds";

// GET /rounds/{roundId}/brief with header `x-ticket` → { product, brief, role } for the ticket's own side
export const handler = handle(async (event: APIGatewayProxyEventV2) =>
  json(200, await getBrief(event.headers["x-ticket"], event.pathParameters!.roundId!)),
);

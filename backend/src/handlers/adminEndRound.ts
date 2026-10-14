import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { adminEndRound } from "../lib/reports";

// POST /admin/rounds/{roundId}/end (IAM) → { status } ends a live round, cancels a ready one
export const handler = handle(async (event: APIGatewayProxyEventV2) => json(200, await adminEndRound(event.pathParameters!.roundId!)));

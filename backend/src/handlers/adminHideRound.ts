import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { adminHideRound } from "../lib/reports";

// POST /admin/rounds/{roundId}/hide (IAM) → { hidden: true }
export const handler = handle(async (event: APIGatewayProxyEventV2) => json(200, await adminHideRound(event.pathParameters!.roundId!)));

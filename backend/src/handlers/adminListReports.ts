import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handle, json } from "../lib/http";
import { listReports } from "../lib/reports";

// GET /admin/reports?cursor= (IAM) → { reports, nextCursor? } newest first
export const handler = handle(async (event: APIGatewayProxyEventV2) => json(200, await listReports(event.queryStringParameters?.cursor)));

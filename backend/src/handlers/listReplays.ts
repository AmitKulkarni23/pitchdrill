import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listReplays } from "../lib/comments";
import { handle, json } from "../lib/http";

// GET /replays?cursor= → { replays, nextCursor? } newest first
export const handler = handle(async (event: APIGatewayProxyEventV2) => json(200, await listReplays(event.queryStringParameters?.cursor)));

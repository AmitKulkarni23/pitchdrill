import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listComments } from "../lib/comments";
import { handle, json } from "../lib/http";

// GET /rounds/{roundId}/comments?cursor= → { comments, nextCursor? } oldest first
export const handler = handle(async (event: APIGatewayProxyEventV2) =>
  json(200, await listComments(event.pathParameters!.roundId!, event.queryStringParameters?.cursor)),
);

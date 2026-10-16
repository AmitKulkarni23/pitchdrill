import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "../lib/db";
import { handle, json } from "../lib/http";
import { requireRound } from "../lib/rounds";
import { decodeCursor, encodeCursor, requireRoundId } from "../lib/validation";

// GET /rounds/{roundId}/comments?cursor= → { comments: [{ commentId, nickname, text, createdAt }], nextCursor? }, oldest first.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  await requireRound(roundId);
  const res = await db.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :c)",
      ExpressionAttributeValues: { ":pk": `ROUND#${roundId}`, ":c": "COMMENT#" },
      Limit: 50,
      ExclusiveStartKey: decodeCursor(event.queryStringParameters?.cursor, ["PK", "SK"]),
    }),
  );
  const comments = (res.Items ?? []).map(({ commentId, nickname, text, createdAt }) => ({ commentId, nickname, text, createdAt }));
  return json(200, { comments, nextCursor: encodeCursor(res.LastEvaluatedKey) });
});

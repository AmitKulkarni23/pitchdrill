import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "../lib/db";
import { handle, json } from "../lib/http";
import { toPublicRound, type RoundMeta } from "../lib/rounds";
import { decodeCursor, encodeCursor } from "../lib/validation";

// GET /replays?cursor= → { replays, nextCursor? }, newest first.
export const handler = handle(async (event) => {
  const res = await db.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :r",
      ExpressionAttributeValues: { ":r": "REPLAY" },
      ScanIndexForward: false,
      Limit: 20,
      ExclusiveStartKey: decodeCursor(event.queryStringParameters?.cursor, ["PK", "SK", "GSI1PK", "GSI1SK"]),
    }),
  );
  const replays = ((res.Items ?? []) as RoundMeta[]).filter((r) => !r.hidden).map(toPublicRound);
  return json(200, { replays, nextCursor: encodeCursor(res.LastEvaluatedKey) });
});

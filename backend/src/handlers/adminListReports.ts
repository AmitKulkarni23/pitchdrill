import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "../lib/db";
import { handle, json } from "../lib/http";
import type { RoundMeta } from "../lib/rounds";
import { decodeCursor, encodeCursor } from "../lib/validation";

// GET /admin/reports?cursor= (IAM) → { reports: [{ roundId, reason, createdAt, round: { status, sellerHandle, buyerHandle, hidden } }], nextCursor? }
export const handler = handle(async (event) => {
  const res = await db.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": "REPORTS" },
      ScanIndexForward: false,
      Limit: 50,
      ExclusiveStartKey: decodeCursor(event.queryStringParameters?.cursor, ["PK", "SK"]),
    }),
  );
  const items = res.Items ?? [];
  const ids = [...new Set(items.map((i) => i.roundId as string))];
  const rounds = new Map<string, RoundMeta>();
  if (ids.length) {
    const got = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: ids.map((id) => ({ PK: `ROUND#${id}`, SK: "META" })) } } }));
    for (const r of (got.Responses?.[TABLE] ?? []) as RoundMeta[]) rounds.set(r.roundId, r);
  }
  const reports = items.map((i) => {
    const r = rounds.get(i.roundId);
    return { roundId: i.roundId, reason: i.reason, createdAt: i.createdAt, round: r && { status: r.status, sellerHandle: r.sellerHandle, buyerHandle: r.buyerHandle, hidden: !!r.hidden } };
  });
  return json(200, { reports, nextCursor: encodeCursor(res.LastEvaluatedKey) });
});

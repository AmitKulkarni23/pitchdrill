import { randomUUID } from "node:crypto";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "./db";
import { UserError } from "./http";
import { roundPk } from "./keys";
import { endRound } from "./lifecycle/end";
import { cancelRound } from "./lifecycle/start";
import { decodeCursor, encodeCursor } from "./pagination";

const REPORTS_PK = "REPORTS";
const PAGE = 50;

export function requireReason(body: Record<string, unknown>): string {
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 1 || reason.length > 300) throw new UserError(400, "bad_reason", "Reasons are 1–300 characters.");
  return reason;
}

/** The round's META including hidden rounds (reports and admin actions must still reach them). */
async function anyRound(roundId: string) {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: roundPk(roundId), SK: "META" } }));
  if (!Item) throw new UserError(404, "round_not_found", "That round doesn't exist.");
  return Item;
}

/** Anyone can report a round, once per browser. Writes the round's report and the admin index entry together. */
export async function reportRound(roundId: string, voterId: string, reason: string, now = Date.now()) {
  await anyRound(roundId);
  const createdAt = new Date(now).toISOString();
  const reportId = randomUUID();
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE, Item: { PK: roundPk(roundId), SK: `REPORTER#${voterId}` }, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: TABLE, Item: { PK: roundPk(roundId), SK: `REPORT#${createdAt}#${reportId}`, reportId, voterId, reason, createdAt } } },
          { Put: { TableName: TABLE, Item: { PK: REPORTS_PK, SK: `${createdAt}#${roundId}#${reportId}`, roundId, reportId, voterId, reason, createdAt } } },
        ],
      }),
    );
  } catch (e) {
    if (e instanceof TransactionCanceledException && e.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed")
      throw new UserError(409, "already_reported", "You already reported this round.");
    throw e;
  }
  return { reported: true };
}

/** Admin: recent reports, newest first, with each round's status and handles. */
export async function listReports(cursor?: string) {
  const page = await db.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": REPORTS_PK },
      ScanIndexForward: false,
      Limit: PAGE,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );
  const items = page.Items ?? [];
  const ids = [...new Set(items.map((i) => i.roundId as string))];
  const rounds = new Map<string, Record<string, any>>();
  if (ids.length) {
    let keys: Record<string, unknown>[] = ids.map((id) => ({ PK: roundPk(id), SK: "META" }));
    while (keys.length) {
      const out = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: keys } } }));
      for (const r of out.Responses?.[TABLE] ?? []) rounds.set(r.roundId, r);
      keys = out.UnprocessedKeys?.[TABLE]?.Keys ?? [];
    }
  }
  return {
    reports: items.map((i) => {
      const r = rounds.get(i.roundId);
      return {
        roundId: i.roundId,
        reason: i.reason,
        createdAt: i.createdAt,
        status: r?.status,
        sellerHandle: r?.sellerHandle,
        buyerHandle: r?.buyerHandle,
        hidden: Boolean(r?.hidden),
      };
    }),
    nextCursor: encodeCursor(page.LastEvaluatedKey),
  };
}

/** Admin: stop a live round now, or cancel one that has not started. */
export async function adminEndRound(roundId: string) {
  const round = await anyRound(roundId);
  if (round.status === "live") {
    await endRound(round, "admin");
    return { status: "ended" };
  }
  if (round.status === "ready") {
    await cancelRound(round, "admin");
    return { status: "cancelled" };
  }
  throw new UserError(409, "round_not_active", "That round isn't live or about to start.", { status: round.status });
}

/** Admin: hide a round everywhere and drop it from the replay feed. Idempotent. */
export async function adminHideRound(roundId: string) {
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: roundPk(roundId), SK: "META" },
        UpdateExpression: "SET #h = :t REMOVE GSI1PK, GSI1SK",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: { "#h": "hidden" },
        ExpressionAttributeValues: { ":t": true },
      }),
    );
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) throw new UserError(404, "round_not_found", "That round doesn't exist.");
    throw e;
  }
  return { hidden: true };
}

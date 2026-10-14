import { randomUUID } from "node:crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "./db";
import { UserError } from "./http";
import { roundPk } from "./keys";
import { decodeCursor, encodeCursor } from "./pagination";
import { getRoundMeta, toPublicRound, type PublicRound } from "./rounds";

const PAGE = 50;
const REPLAY_PAGE = 20;

export function requireCommentText(body: Record<string, unknown>): string {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > 500) throw new UserError(400, "bad_comment", "Comments are 1–500 characters.");
  return text;
}

/** Replay feed: rounds with a recording, newest first. */
export async function listReplays(cursor?: string): Promise<{ replays: PublicRound[]; nextCursor?: string }> {
  const page = await db.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :replay",
      ExpressionAttributeValues: { ":replay": "REPLAY" },
      ScanIndexForward: false,
      Limit: REPLAY_PAGE,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );
  return {
    replays: (page.Items ?? []).filter((r) => !r.hidden).map(toPublicRound),
    nextCursor: encodeCursor(page.LastEvaluatedKey),
  };
}

/** Comments of a round, oldest first. voterId is never returned. */
export async function listComments(roundId: string, cursor?: string) {
  await getRoundMeta(roundId);
  const page = await db.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :c)",
      ExpressionAttributeValues: { ":pk": roundPk(roundId), ":c": "COMMENT#" },
      Limit: PAGE,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );
  return {
    comments: (page.Items ?? []).map((c) => ({ commentId: c.commentId, nickname: c.nickname, text: c.text, createdAt: c.createdAt })),
    nextCursor: encodeCursor(page.LastEvaluatedKey),
  };
}

/** Comments open at the buzzer and stay open on replays. */
export async function createComment(roundId: string, voterId: string, nickname: string, text: string, now = Date.now()) {
  const meta = await getRoundMeta(roundId);
  if (meta.status !== "ended" && meta.status !== "closed")
    throw new UserError(409, "comments_closed", "Comments open when the round ends.", { status: meta.status });
  const lower = nickname.toLowerCase();
  if (lower === String(meta.sellerHandle).toLowerCase() || lower === String(meta.buyerHandle).toLowerCase())
    throw new UserError(409, "nickname_taken", "That nickname belongs to a player in this round. Pick another.");
  const createdAt = new Date(now).toISOString();
  const commentId = randomUUID();
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: roundPk(roundId), SK: `COMMENT#${createdAt}#${commentId}`, commentId, voterId, nickname, text, createdAt } }));
  return { commentId, nickname, text, createdAt };
}

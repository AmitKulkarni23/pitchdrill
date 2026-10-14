// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, describe, expect, test } from "bun:test";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createLocalTable } from "../src/dev/localTable";
import { createComment, listComments, requireCommentText } from "../src/lib/comments";
import { db, TABLE } from "../src/lib/db";

const voterId = "123e4567-e89b-42d3-a456-426614174000";
let n = 0;
async function round(status: string, extra: Record<string, unknown> = {}) {
  const roundId = `cm-${n++}`;
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `ROUND#${roundId}`, SK: "META", roundId, status, sellerHandle: "Sally", buyerHandle: "Bob_B", ...extra } }));
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("comments", () => {
  beforeAll(createLocalTable);

  test("given ended round, should store and return comment", async () => {
    const id = await round("ended");
    const c = await createComment(id, voterId, "Fan", "Great close!", Date.parse("2099-01-01T00:00:00Z"));
    expect(c).toMatchObject({ nickname: "Fan", text: "Great close!", createdAt: "2099-01-01T00:00:00.000Z" });
    const stored = (await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `ROUND#${id}`, SK: `COMMENT#${c.createdAt}#${c.commentId}` } }))).Item;
    expect(stored?.voterId).toBe(voterId);
  });

  test("given live round, should reject", async () => {
    expect(createComment(await round("live"), voterId, "Fan", "hi")).rejects.toMatchObject({ status: 409, code: "comments_closed" });
  });

  test("given a player's handle as nickname, should reject nickname_taken", async () => {
    expect(createComment(await round("closed"), voterId, "sally", "hi")).rejects.toMatchObject({ code: "nickname_taken" });
  });

  test("given 501 chars or blank, should 400", () => {
    expect(() => requireCommentText({ text: "x".repeat(501) })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => requireCommentText({ text: "   " })).toThrow();
    expect(requireCommentText({ text: " ok " })).toBe("ok");
    expect(requireCommentText({ text: "x".repeat(500) })).toHaveLength(500);
  });

  test("should be oldest first, omit voterId and 404 for hidden rounds", async () => {
    const id = await round("closed");
    await createComment(id, voterId, "B", "second", Date.parse("2099-01-01T00:00:02Z"));
    await createComment(id, voterId, "A", "first", Date.parse("2099-01-01T00:00:01Z"));
    const { comments, nextCursor } = await listComments(id);
    expect(comments.map((c) => c.text)).toEqual(["first", "second"]);
    expect(JSON.stringify(comments)).not.toContain("voterId");
    expect(JSON.stringify(comments)).not.toContain(voterId);
    expect(nextCursor).toBeUndefined();
    expect(listComments(await round("closed", { hidden: true }))).rejects.toMatchObject({ status: 404 });
  });
});

// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, describe, expect, test } from "bun:test";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { createLocalTable } from "../src/dev/localTable";
import { listReplays } from "../src/lib/comments";
import { db, TABLE } from "../src/lib/db";

async function replay(i: number, extra: Record<string, unknown> = {}) {
  const endedAt = new Date(Date.UTC(2099, 5, 1, 0, i)).toISOString();
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `ROUND#rp-${i}`, SK: "META", roundId: `rp-${i}`, slotId: "s", status: "closed", sellerHandle: "a", buyerHandle: "b", votesSold: 0, votesNotSold: 0, endedAt, ...extra },
    }),
  );
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("replays", () => {
  beforeAll(async () => {
    await createLocalTable();
    for (let i = 0; i < 25; i++) await replay(i, { GSI1PK: "REPLAY", GSI1SK: new Date(Date.UTC(2099, 5, 1, 0, i)).toISOString() });
    await replay(100, {}); // hidden: no GSI keys
  });

  test("should return newest first and paginate with cursor", async () => {
    const first = await listReplays();
    expect(first.replays).toHaveLength(20);
    expect(first.replays[0]!.roundId).toBe("rp-24");
    expect(first.nextCursor).toBeDefined();
    const second = await listReplays(first.nextCursor);
    expect(second.replays.map((r) => r.roundId)).toEqual(["rp-4", "rp-3", "rp-2", "rp-1", "rp-0"]);
    expect(second.nextCursor).toBeUndefined();
  });

  test("should exclude hidden rounds", async () => {
    const ids = [...(await listReplays()).replays, ...(await listReplays((await listReplays()).nextCursor)).replays].map((r) => r.roundId);
    expect(ids).not.toContain("rp-100");
  });
});

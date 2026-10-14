// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, describe, expect, test } from "bun:test";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createLocalTable } from "../src/dev/localTable";
import { db, TABLE } from "../src/lib/db";
import { listReports, reportRound, requireReason } from "../src/lib/reports";

const v1 = "123e4567-e89b-42d3-a456-426614174001";
const v2 = "123e4567-e89b-42d3-a456-426614174002";
let n = 0;
async function round(status = "ended") {
  const roundId = `rep-${n++}`;
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `ROUND#${roundId}`, SK: "META", roundId, status, sellerHandle: "S", buyerHandle: "B" } }));
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("reports", () => {
  beforeAll(createLocalTable);

  test("should write round report and REPORTS index", async () => {
    const id = await round();
    const at = Date.parse("2099-01-01T00:00:00Z");
    expect(await reportRound(id, v1, "rude", at)).toEqual({ reported: true });
    const idx = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `ROUND#${id}`, SK: `REPORTER#${v1}` } }));
    expect(idx.Item).toBeDefined();
    const { reports } = await listReports();
    expect(reports.find((r) => r.roundId === id)).toMatchObject({ reason: "rude", createdAt: "2099-01-01T00:00:00.000Z", status: "ended", sellerHandle: "S" });
  });

  test("same voter twice, should return already_reported", async () => {
    const id = await round();
    await reportRound(id, v1, "a");
    expect(reportRound(id, v1, "b")).rejects.toMatchObject({ status: 409, code: "already_reported" });
    expect(await reportRound(id, v2, "c")).toEqual({ reported: true });
  });

  test("missing round should 404; reason is validated", async () => {
    expect(reportRound("nope", v1, "x")).rejects.toMatchObject({ status: 404 });
    expect(() => requireReason({ reason: "x".repeat(301) })).toThrow(expect.objectContaining({ code: "bad_reason" }));
    expect(() => requireReason({ reason: "  " })).toThrow();
  });

  test("listReports should be newest first with round status", async () => {
    await createLocalTable();
    const a = await round("live");
    const b = await round("closed");
    await reportRound(a, v1, "older", Date.parse("2099-01-01T00:00:00Z"));
    await reportRound(b, v1, "newer", Date.parse("2099-01-02T00:00:00Z"));
    const { reports } = await listReports();
    expect(reports.map((r) => [r.reason, r.status])).toEqual([["newer", "closed"], ["older", "live"]]);
    expect(JSON.stringify(reports)).not.toContain(v1);
  });
});

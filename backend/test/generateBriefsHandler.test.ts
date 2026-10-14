// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";

const generate = mock();
mock.module("../src/lib/briefs", () => ({ generateBriefs: generate }));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { handler } = await import("../src/handlers/generateBriefs");

const briefs = { product: { name: "W", price: "$1", tagline: "t" }, seller: "s", buyer: "b", source: "openrouter" };
const event = (PK: string, eventName = "INSERT", SK = "META") =>
  ({ Records: [{ eventName, dynamodb: { Keys: { PK: { S: PK }, SK: { S: SK } } } }] }) as unknown as DynamoDBStreamEvent;
const meta = async (PK: string) => (await db.send(new GetCommand({ TableName: TABLE, Key: { PK, SK: "META" } }))).Item;

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("generateBriefs handler", () => {
  beforeAll(createLocalTable);
  beforeEach(async () => {
    generate.mockReset();
    for (const id of ["a", "b", "c"]) await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `ROUND#${id}`, SK: "META", roundId: id } }));
  });

  test("given META insert, should store briefs once", async () => {
    generate.mockResolvedValue(briefs);
    await handler(event("ROUND#a"));
    expect((await meta("ROUND#a"))?.briefs).toEqual(briefs);
    generate.mockResolvedValue({ ...briefs, seller: "other" });
    await handler(event("ROUND#a")); // second run is a no-op
    expect((await meta("ROUND#a"))?.briefs.seller).toBe("s");
  });

  test("given generation failure, should not throw and leave briefs unset", async () => {
    generate.mockRejectedValue(new Error("boom"));
    await handler(event("ROUND#b"));
    expect((await meta("ROUND#b"))?.briefs).toBeUndefined();
  });

  test("ignores non-META and non-INSERT records", async () => {
    generate.mockResolvedValue(briefs);
    await handler(event("ROUND#c", "MODIFY"));
    await handler(event("ROUND#c", "INSERT", "VOTE#x"));
    expect(generate).not.toHaveBeenCalled();
  });
});

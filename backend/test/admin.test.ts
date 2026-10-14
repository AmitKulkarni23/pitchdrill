// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ivs } from "./helpers/ivsMock";

const sendRoundEvent = mock();
mock.module("../src/lib/ivs", () => ivs);
mock.module("../src/lib/chatEvents", () => ({ sendRoundEvent }));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { adminEndRound, adminHideRound } = await import("../src/lib/reports");

const item = async (id: string) => (await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `ROUND#${id}`, SK: "META" } }))).Item;
let n = 0;
async function round(status: string, extra: Record<string, unknown> = {}) {
  const roundId = `adm-${n++}`;
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `ROUND#${roundId}`, SK: "META", roundId, status, stageArn: `arn:stage/${roundId}`, chatRoomArn: `arn:room/${roundId}`, compositionArn: `arn:comp/${roundId}`, ...extra },
    }),
  );
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("admin", () => {
  beforeAll(createLocalTable);
  beforeEach(() => {
    for (const m of [...Object.values(ivs), sendRoundEvent]) m.mockReset();
    for (const m of [ivs.deleteStage, ivs.deleteRoom, ivs.stopComposition, sendRoundEvent]) m.mockResolvedValue(undefined);
  });

  test("adminEnd: given live round, should end it with endedBy admin", async () => {
    const id = await round("live", { startedAt: "2099-01-01T00:00:00.000Z" });
    expect(await adminEndRound(id)).toEqual({ status: "ended" });
    expect(await item(id)).toMatchObject({ status: "ended", endedBy: "admin" });
    expect(ivs.stopComposition).toHaveBeenCalledWith(`arn:comp/${id}`);
    expect(sendRoundEvent).toHaveBeenCalledWith(`arn:room/${id}`, "buzzer", {});
  });

  test("adminEnd: given ready round, should cancel with reason admin", async () => {
    const id = await round("ready");
    expect(await adminEndRound(id)).toEqual({ status: "cancelled" });
    expect(await item(id)).toMatchObject({ status: "cancelled", cancelReason: "admin" });
    expect(ivs.deleteStage).toHaveBeenCalledWith(`arn:stage/${id}`);
    expect(ivs.deleteRoom).toHaveBeenCalledWith(`arn:room/${id}`);
  });

  test("adminEnd: given another status, should 409 round_not_active", async () => {
    expect(adminEndRound(await round("closed"))).rejects.toMatchObject({ status: 409, code: "round_not_active" });
    expect(adminEndRound("nope")).rejects.toMatchObject({ status: 404 });
  });

  test("adminHide: should set hidden and remove GSI keys, idempotently", async () => {
    const id = await round("closed", { GSI1PK: "REPLAY", GSI1SK: "2099-01-01T00:00:00.000Z" });
    expect(await adminHideRound(id)).toEqual({ hidden: true });
    await adminHideRound(id);
    const meta = await item(id);
    expect(meta?.hidden).toBe(true);
    expect(meta?.GSI1PK).toBeUndefined();
    expect(meta?.GSI1SK).toBeUndefined();
    expect(adminHideRound("nope")).rejects.toMatchObject({ status: 404 });
  });
});

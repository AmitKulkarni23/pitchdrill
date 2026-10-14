// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const ivs = {
  createStage: mock(),
  createRoom: mock(),
  deleteStage: mock(),
  deleteRoom: mock(),
  getActiveSessionId: mock(),
  listPublishingUserIds: mock(),
  startComposition: mock(),
  stopComposition: mock(),
};
const sendRoundEvent = mock();
const findPlaylist = mock();
const { fallbackBriefs } = await import("../src/lib/fallbackBriefs");
mock.module("../src/lib/briefs", () => ({ generateBriefs: mock(), fallbackBriefs }));
mock.module("../src/lib/ivs", () => ivs);
mock.module("../src/lib/chatEvents", () => ({ sendRoundEvent }));
mock.module("../src/lib/recordings", () => ({ findPlaylist }));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { metrics } = await import("../src/lib/observability");
const { tick, endRound } = await import("../src/handlers/slotTick");
const { slotsForDate } = await import("../src/lib/slots");

const slots = slotsForDate("2099-04-01");
const T = (slotId: string) => Date.parse(slotId);
const item = async (PK: string, SK: string) => (await db.send(new GetCommand({ TableName: TABLE, Key: { PK, SK } }))).Item;

let n = 0;
async function round(slotId: string, fields: Record<string, unknown>) {
  const roundId = `end-${n++}`;
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ROUND#${roundId}`,
        SK: "META",
        roundId,
        slotId,
        stageArn: `arn:stage/${roundId}`,
        chatRoomArn: `arn:room/${roundId}`,
        compositionArn: `arn:composition/${roundId}`,
        votesSold: 0,
        votesNotSold: 0,
        ...fields,
      },
    }),
  );
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `SLOT#${slotId}`, SK: `ROUND#${roundId}`, roundId } }));
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("slotTick end", () => {
  beforeAll(createLocalTable);
  beforeEach(() => {
    for (const m of [...Object.values(ivs), sendRoundEvent, findPlaylist]) m.mockReset();
    for (const m of [ivs.deleteStage, ivs.deleteRoom, ivs.stopComposition, sendRoundEvent]) m.mockResolvedValue(undefined);
  });

  test("given a live round started 61s ago, should send buzzer, stop composition, delete stage, set ended", async () => {
    const s = slots[0]!;
    const now = T(s) + 61_000;
    const id = await round(s, { status: "live", startedAt: new Date(T(s)).toISOString() });
    await tick(now);
    expect(sendRoundEvent).toHaveBeenCalledWith(`arn:room/${id}`, "buzzer", {});
    expect(ivs.stopComposition).toHaveBeenCalledWith(`arn:composition/${id}`);
    expect(ivs.deleteStage).toHaveBeenCalledWith(`arn:stage/${id}`);
    const meta = await item(`ROUND#${id}`, "META");
    expect(meta?.status).toBe("ended");
    expect(Date.parse(meta!.endedAt)).toBeGreaterThan(0);
  });

  test("given a live round started 30s ago, should leave it live", async () => {
    const s = slots[2]!;
    const id = await round(s, { status: "live", startedAt: new Date(T(s)).toISOString() });
    await tick(T(s) + 30_000);
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("live");
    expect(ivs.deleteStage).not.toHaveBeenCalled();
    expect(sendRoundEvent).not.toHaveBeenCalled();
  });

  test("given an ended round at T+15m, should delete room and set closed", async () => {
    const s = slots[4]!;
    const id = await round(s, { status: "ended", endedAt: new Date(T(s) + 61_000).toISOString() });
    await tick(T(s) + 14 * 60_000);
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("ended");
    await tick(T(s) + 15 * 60_000);
    expect(ivs.deleteRoom).toHaveBeenCalledWith(`arn:room/${id}`);
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("closed");
  });

  test("given the playlist exists in S3, should set recordingPath and GSI1 keys", async () => {
    const s = slots[6]!;
    const endedAt = new Date(T(s) + 61_000).toISOString();
    const id = await round(s, { status: "ended", endedAt });
    findPlaylist.mockResolvedValue("stage/comp/media/hls/multivariant.m3u8");
    await tick(T(s) + 2 * 60_000);
    expect(await item(`ROUND#${id}`, "META")).toMatchObject({ recordingPath: "stage/comp/media/hls/multivariant.m3u8", GSI1PK: "REPLAY", GSI1SK: endedAt });
  });

  test("given a hidden round, should not register a recording", async () => {
    const s = slots[8]!;
    const id = await round(s, { status: "ended", endedAt: new Date(T(s) + 61_000).toISOString(), hidden: true });
    findPlaylist.mockResolvedValue("x/multivariant.m3u8");
    await tick(T(s) + 2 * 60_000);
    expect((await item(`ROUND#${id}`, "META"))?.recordingPath).toBeUndefined();
  });

  test("given no playlist at T+20m, should emit RecordingMissing once", async () => {
    const s = slots[10]!;
    const id = await round(s, { status: "closed", endedAt: new Date(T(s) + 61_000).toISOString() });
    const add = spyOn(metrics, "addMetric");
    findPlaylist.mockResolvedValue(undefined);
    await tick(T(s) + 19 * 60_000);
    expect(add).not.toHaveBeenCalledWith("RecordingMissing", expect.anything(), 1);
    await tick(T(s) + 20 * 60_000);
    await tick(T(s) + 21 * 60_000);
    expect(add.mock.calls.filter((c) => c[0] === "RecordingMissing").length).toBe(1);
    expect((await item(`ROUND#${id}`, "META"))?.recordingMissingAt).toBeDefined();
    add.mockRestore();
  });

  test("endRound: given ResourceNotFound handled by IVS wrappers, should still set ended with endedBy", async () => {
    const s = slots[12]!;
    const id = await round(s, { status: "live", startedAt: new Date(T(s)).toISOString() });
    await endRound((await item(`ROUND#${id}`, "META"))!, "admin");
    expect(await item(`ROUND#${id}`, "META")).toMatchObject({ status: "ended", endedBy: "admin" });
    await endRound((await item(`ROUND#${id}`, "META"))!, "admin"); // second call is a no-op
  });
});

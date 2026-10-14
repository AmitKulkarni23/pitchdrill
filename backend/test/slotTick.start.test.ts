// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const ivs = {
  createStage: mock(),
  createRoom: mock(),
  deleteStage: mock(),
  deleteRoom: mock(),
  getActiveSessionId: mock(),
  listPublishingUserIds: mock(),
  startComposition: mock(),
};
const sendRoundEvent = mock();
const { fallbackBriefs } = await import("../src/lib/fallbackBriefs");
mock.module("../src/lib/briefs", () => ({ generateBriefs: mock(), fallbackBriefs }));
mock.module("../src/lib/ivs", () => ivs);
mock.module("../src/lib/chatEvents", () => ({ sendRoundEvent }));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { tick, startSlot } = await import("../src/handlers/slotTick");
const { slotsForDate } = await import("../src/lib/slots");

const slots = slotsForDate("2099-03-01");
const T = (slotId: string) => Date.parse(slotId);
const item = async (PK: string, SK: string) => (await db.send(new GetCommand({ TableName: TABLE, Key: { PK, SK } }))).Item;

let n = 0;
/** A round already in `ready`, as SlotTick's open phase would leave it. */
async function readyRound(slotId: string, status = "ready") {
  const roundId = `start-${n++}`;
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ROUND#${roundId}`,
        SK: "META",
        roundId,
        slotId,
        sellerBookingId: `${roundId}-s`,
        buyerBookingId: `${roundId}-b`,
        sellerHandle: "s",
        buyerHandle: "b",
        status,
        stageArn: `arn:stage/${roundId}`,
        chatRoomArn: `arn:room/${roundId}`,
        votesSold: 0,
        votesNotSold: 0,
      },
    }),
  );
  await db.send(new PutCommand({ TableName: TABLE, Item: { PK: `SLOT#${slotId}`, SK: `ROUND#${roundId}`, roundId } }));
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("slotTick start", () => {
  beforeAll(createLocalTable);
  beforeEach(() => {
    for (const m of [...Object.values(ivs), sendRoundEvent]) m.mockReset();
    ivs.deleteStage.mockResolvedValue(undefined);
    ivs.deleteRoom.mockResolvedValue(undefined);
    sendRoundEvent.mockResolvedValue(undefined);
    ivs.getActiveSessionId.mockResolvedValue("session-1");
    ivs.startComposition.mockImplementation(async (stageArn: string) => `arn:composition/${stageArn}`);
    process.env.STORAGE_CONFIGURATION_ARN_ENV = "arn:storage";
    process.env.ENCODER_CONFIGURATION_ARN_ENV = "arn:encoder";
  });

  test("given both participants publishing, should start composition and set status live", async () => {
    const s = slots[0]!;
    const id = await readyRound(s);
    ivs.listPublishingUserIds.mockResolvedValue([`${id}-s`, `${id}-b`]);
    await startSlot(s);
    expect(ivs.startComposition).toHaveBeenCalledWith(`arn:stage/${id}`);
    const meta = await item(`ROUND#${id}`, "META");
    expect(meta).toMatchObject({ status: "live", compositionArn: `arn:composition/arn:stage/${id}` });
    expect(Date.parse(meta!.startedAt)).toBeGreaterThan(0);
    expect(ivs.deleteStage).not.toHaveBeenCalled();
  });

  test("should send round_started with startedAt", async () => {
    const s = slots[1]!;
    const id = await readyRound(s);
    ivs.listPublishingUserIds.mockResolvedValue([`${id}-s`, `${id}-b`]);
    await startSlot(s);
    const meta = await item(`ROUND#${id}`, "META");
    expect(sendRoundEvent).toHaveBeenCalledWith(`arn:room/${id}`, "round_started", { startedAt: meta!.startedAt });
  });

  test("given only the seller publishing, should cancel as no_show and delete stage + room", async () => {
    const s = slots[2]!;
    const id = await readyRound(s);
    ivs.listPublishingUserIds.mockResolvedValue([`${id}-s`]);
    await startSlot(s);
    expect(await item(`ROUND#${id}`, "META")).toMatchObject({ status: "cancelled", cancelReason: "no_show" });
    expect(sendRoundEvent).toHaveBeenCalledWith(`arn:room/${id}`, "round_cancelled", { reason: "no_show" });
    expect(ivs.deleteStage).toHaveBeenCalledWith(`arn:stage/${id}`);
    expect(ivs.deleteRoom).toHaveBeenCalledWith(`arn:room/${id}`);
    expect(ivs.startComposition).not.toHaveBeenCalled();
  });

  test("given no active session, should cancel as no_show", async () => {
    const s = slots[3]!;
    const id = await readyRound(s);
    ivs.getActiveSessionId.mockResolvedValue(undefined);
    await startSlot(s);
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("cancelled");
    expect(ivs.listPublishingUserIds).not.toHaveBeenCalled();
  });

  test("given a round already live, should do nothing", async () => {
    const s = slots[4]!;
    const id = await readyRound(s, "live");
    await startSlot(s);
    await startSlot(s);
    expect(ivs.getActiveSessionId).not.toHaveBeenCalled();
    expect(sendRoundEvent).not.toHaveBeenCalled();
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("live");
  });

  test("given a chat event failure, should still go live", async () => {
    const s = slots[5]!;
    const id = await readyRound(s);
    ivs.listPublishingUserIds.mockResolvedValue([`${id}-s`, `${id}-b`]);
    sendRoundEvent.mockRejectedValue(new Error("chat down"));
    await startSlot(s);
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("live");
  });

  test("tick: before T, should not start rounds; at T, should", async () => {
    const s = slots[6]!;
    const id = await readyRound(s);
    ivs.listPublishingUserIds.mockResolvedValue([`${id}-s`, `${id}-b`]);
    await tick(T(s) - 60_000);
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("ready");
    await tick(T(s));
    expect((await item(`ROUND#${id}`, "META"))?.status).toBe("live");
  });
});

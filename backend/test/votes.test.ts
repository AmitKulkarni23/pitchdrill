// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const sendRoundEvent = mock();
mock.module("../src/lib/chatEvents", () => ({ sendRoundEvent }));

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { castVote } = await import("../src/lib/votes");

let n = 0;
const voter = () => `00000000-0000-4000-8000-${String(n++).padStart(12, "0")}`;
async function round(status: string, extra: Record<string, unknown> = {}) {
  const roundId = `vote-${n++}`;
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `ROUND#${roundId}`, SK: "META", roundId, status, votesSold: 0, votesNotSold: 0, chatRoomArn: `arn:room/${roundId}`, ...extra },
    }),
  );
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("votes", () => {
  beforeAll(createLocalTable);
  beforeEach(() => {
    sendRoundEvent.mockReset();
    sendRoundEvent.mockResolvedValue(undefined);
  });

  test("given an ended round, should record vote and return tally", async () => {
    const id = await round("ended");
    expect(await castVote(id, voter(), "sold")).toEqual({ votesSold: 1, votesNotSold: 0 });
    expect(await castVote(id, voter(), "not_sold")).toEqual({ votesSold: 1, votesNotSold: 1 });
  });

  test("given a closed round, votes still count (replays)", async () => {
    const id = await round("closed");
    expect(await castVote(id, voter(), "sold")).toEqual({ votesSold: 1, votesNotSold: 0 });
    expect(sendRoundEvent).not.toHaveBeenCalled(); // the chat room is gone
  });

  test("same voter twice, should return already_voted with tally", async () => {
    const id = await round("ended");
    const v = voter();
    await castVote(id, v, "sold");
    const err = await castVote(id, v, "not_sold").catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: "already_voted", extra: { votesSold: 1, votesNotSold: 0 } });
    expect(await castVote(id, voter(), "sold")).toEqual({ votesSold: 2, votesNotSold: 0 });
  });

  test("given a live round, should return voting_closed", async () => {
    const id = await round("live");
    expect(castVote(id, voter(), "sold")).rejects.toMatchObject({ status: 409, code: "voting_closed" });
  });

  test("given hidden or missing round, should not count", async () => {
    const id = await round("ended", { hidden: true });
    expect(castVote(id, voter(), "sold")).rejects.toMatchObject({ status: 404 });
    expect(castVote("nope", voter(), "sold")).rejects.toMatchObject({ status: 404 });
  });

  test("given status ended, should send tally event", async () => {
    const id = await round("ended");
    await castVote(id, voter(), "sold");
    expect(sendRoundEvent).toHaveBeenCalledWith(`arn:room/${id}`, "tally", { sold: "1", notSold: "0" });
  });

  test("given SendEvent failure, should still succeed", async () => {
    sendRoundEvent.mockRejectedValue(new Error("chat down"));
    const id = await round("ended");
    expect(await castVote(id, voter(), "sold")).toEqual({ votesSold: 1, votesNotSold: 0 });
  });

  test("10 concurrent voters, should count 10", async () => {
    const id = await round("ended");
    await Promise.all(Array.from({ length: 10 }, (_, i) => castVote(id, voter(), i % 2 ? "sold" : "not_sold")));
    expect(await castVote(id, voter(), "sold")).toEqual({ votesSold: 6, votesNotSold: 5 });
  });
});

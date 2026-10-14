// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set.
import { beforeAll, describe, expect, mock, test } from "bun:test";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ivs } from "./helpers/ivsMock";

mock.module("../src/lib/ivs", () => ivs);
ivs.createChatToken.mockResolvedValue({ token: "chat", sessionExpirationTime: "s", tokenExpirationTime: "t" });

const { createLocalTable } = await import("../src/dev/localTable");
const { db, TABLE } = await import("../src/lib/db");
const { spectatorChatToken } = await import("../src/lib/rounds");

const voterId = "123e4567-e89b-42d3-a456-426614174000";
let n = 0;
async function round(status: string) {
  const roundId = `chat-${n++}`;
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `ROUND#${roundId}`, SK: "META", roundId, status, sellerHandle: "Sally", buyerHandle: "Bob_B", chatRoomArn: `arn:room/${roundId}` },
    }),
  );
  return roundId;
}

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("chat token", () => {
  beforeAll(createLocalTable);

  test("should request SEND_MESSAGE token with nickname attribute", async () => {
    const id = await round("live");
    ivs.createChatToken.mockClear();
    expect(await spectatorChatToken(id, voterId, "Fan 1")).toEqual({ token: "chat", sessionExpirationTime: "s", tokenExpirationTime: "t" });
    expect(ivs.createChatToken).toHaveBeenCalledWith({
      roomIdentifier: `arn:room/${id}`,
      userId: `viewer-${voterId}`,
      capabilities: ["SEND_MESSAGE"],
      attributes: { nickname: "Fan 1" },
      sessionDurationInMinutes: 60,
    });
  });

  test("given closed or unpaired round, should return chat_closed", async () => {
    for (const status of ["closed", "cancelled", "paired"])
      expect(spectatorChatToken(await round(status), voterId, "Fan")).rejects.toMatchObject({ status: 409, code: "chat_closed" });
    expect(spectatorChatToken(await round("ended"), voterId, "Fan")).resolves.toBeDefined();
  });

  test("given nickname equal to a player handle (any case), should return nickname_taken", async () => {
    const id = await round("live");
    expect(spectatorChatToken(id, voterId, "SALLY")).rejects.toMatchObject({ status: 409, code: "nickname_taken" });
    expect(spectatorChatToken(id, voterId, "bob_b")).rejects.toMatchObject({ code: "nickname_taken" });
  });
});

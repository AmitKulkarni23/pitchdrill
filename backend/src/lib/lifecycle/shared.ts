import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { sendRoundEvent } from "../chatEvents";
import { db, TABLE } from "../db";
import { roundPk, slotPk } from "../keys";
import { logger } from "../observability";

export const MIN = 60_000;
export type Round = Record<string, any>;

export async function roundsOf(slotId: string): Promise<Round[]> {
  const ids: string[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :r)",
        ExpressionAttributeValues: { ":pk": slotPk(slotId), ":r": "ROUND#" },
        ExclusiveStartKey,
      }),
    );
    ids.push(...(page.Items ?? []).map((i) => i.roundId as string));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const rounds: Round[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let keys: Record<string, unknown>[] = ids.slice(i, i + 100).map((id) => ({ PK: roundPk(id), SK: "META" }));
    while (keys.length) {
      const out = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: keys } } }));
      rounds.push(...(out.Responses?.[TABLE] ?? []));
      keys = out.UnprocessedKeys?.[TABLE]?.Keys ?? [];
    }
  }
  return rounds;
}

/** Moves a round from one status to another; false when a concurrent tick already moved it. */
export async function transitionRound(roundId: string, from: string, to: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const sets = ["#s = :to", ...Object.keys(extra).map((k) => `${k} = :${k}`)];
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: roundPk(roundId), SK: "META" },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "#s = :from",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":from": from, ":to": to, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`:${k}`, v])) },
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) return false;
    throw e;
  }
}

/** Chat events are best effort: a failed announcement must not undo the transition. */
export async function announce(round: Round, eventName: string, attributes: Record<string, string>) {
  await sendRoundEvent(round.chatRoomArn, eventName, attributes).catch((e) =>
    logger.warn("Chat event failed", { roundId: round.roundId, eventName, error: (e as Error).message }),
  );
}

export async function getRound(roundId: string): Promise<Round | undefined> {
  return (await db.send(new GetCommand({ TableName: TABLE, Key: { PK: roundPk(roundId), SK: "META" } }))).Item;
}

import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { sendRoundEvent } from "./chatEvents";
import { db, TABLE } from "./db";
import { UserError } from "./http";
import { roundPk } from "./keys";
import { getRoundMeta } from "./rounds";
import { logger, metrics } from "./observability";

export type Vote = "sold" | "not_sold";

export function requireVote(body: Record<string, unknown>): Vote {
  if (body.vote !== "sold" && body.vote !== "not_sold") throw new UserError(400, "bad_vote", "Vote must be sold or not_sold.");
  return body.vote;
}

const tallyOf = (meta: Record<string, any>) => ({ votesSold: meta.votesSold ?? 0, votesNotSold: meta.votesNotSold ?? 0 });

async function currentRound(roundId: string) {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: roundPk(roundId), SK: "META" }, ConsistentRead: true }));
  return Item;
}

/** One vote per voter per round, open from the buzzer on (ended/closed), forever. */
export async function castVote(roundId: string, voterId: string, vote: Vote) {
  await getRoundMeta(roundId); // 404 for missing or hidden rounds
  const pk = roundPk(roundId);
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: { PK: pk, SK: `VOTE#${voterId}`, vote, createdAt: new Date().toISOString() },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: TABLE,
              Key: { PK: pk, SK: "META" },
              UpdateExpression: `ADD ${vote === "sold" ? "votesSold" : "votesNotSold"} :one`,
              ConditionExpression: "#s IN (:ended, :closed) AND attribute_not_exists(#h)",
              ExpressionAttributeNames: { "#s": "status", "#h": "hidden" },
              ExpressionAttributeValues: { ":one": 1, ":ended": "ended", ":closed": "closed" },
            },
          },
        ],
      }),
    );
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e;
    const reasons = e.CancellationReasons ?? [];
    if (reasons[1]?.Code === "ConditionalCheckFailed") throw new UserError(409, "voting_closed", "Voting opens at the buzzer.");
    if (reasons[0]?.Code === "ConditionalCheckFailed") {
      const meta = await currentRound(roundId);
      throw new UserError(409, "already_voted", "You already voted in this round.", meta ? tallyOf(meta) : {});
    }
    throw e;
  }
  metrics.addMetric("VoteCast", MetricUnit.Count, 1);
  const meta = (await currentRound(roundId))!;
  const tally = tallyOf(meta);
  // The chat room only exists until the round is closed; the tally event is best effort.
  if (meta.status === "ended" && meta.chatRoomArn)
    await sendRoundEvent(meta.chatRoomArn, "tally", { sold: String(tally.votesSold), notSold: String(tally.votesNotSold) }).catch((err) =>
      logger.warn("Tally event failed", { roundId, error: (err as Error).message }),
    );
  return tally;
}

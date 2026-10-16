import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { db, TABLE } from "../lib/db";
import { handle, json, UserError } from "../lib/http";
import { sendRoundEvent } from "../lib/ivs";
import { logger, metrics } from "../lib/observability";
import type { RoundMeta } from "../lib/rounds";
import { readBody, requireRoundId, requireVoterId } from "../lib/validation";

const getMeta = async (roundId: string) =>
  (await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `ROUND#${roundId}`, SK: "META" }, ConsistentRead: true }))).Item as RoundMeta | undefined;
const tally = (r: RoundMeta) => ({ votesSold: r.votesSold ?? 0, votesNotSold: r.votesNotSold ?? 0 });

// POST /rounds/{roundId}/votes { voterId, vote: "sold" | "not_sold" } → { votesSold, votesNotSold }. One vote per voter, after the buzzer.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const body = readBody(event);
  const voterId = requireVoterId(body.voterId);
  if (body.vote !== "sold" && body.vote !== "not_sold") throw new UserError(400, "bad_vote", "Vote must be sold or not_sold.");
  const pk = `ROUND#${roundId}`;
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE, Item: { PK: pk, SK: `VOTE#${voterId}`, vote: body.vote, createdAt: new Date().toISOString() }, ConditionExpression: "attribute_not_exists(PK)" } },
          {
            Update: {
              TableName: TABLE,
              Key: { PK: pk, SK: "META" },
              UpdateExpression: "ADD #v :one",
              ConditionExpression: "attribute_exists(PK) AND #s IN (:ended, :closed) AND attribute_not_exists(#h)",
              ExpressionAttributeNames: { "#v": body.vote === "sold" ? "votesSold" : "votesNotSold", "#s": "status", "#h": "hidden" },
              ExpressionAttributeValues: { ":one": 1, ":ended": "ended", ":closed": "closed" },
            },
          },
        ],
      }),
    );
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e;
    const round = await getMeta(roundId);
    if (!round || round.hidden) throw new UserError(404, "round_not_found", "That round doesn't exist.");
    if (e.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed") throw new UserError(409, "already_voted", "You've already voted on this round.", tally(round));
    throw new UserError(409, "voting_closed", "Voting opens at the buzzer.", tally(round));
  }
  metrics.addMetric("VoteCast", MetricUnit.Count, 1);
  const round = (await getMeta(roundId))!;
  if (round.status === "ended" && round.chatRoomArn)
    await sendRoundEvent(round.chatRoomArn, "tally", { sold: String(round.votesSold), notSold: String(round.votesNotSold) }).catch((e) =>
      logger.warn("Tally event failed", { roundId, error: (e as Error).message }),
    );
  return json(200, tally(round));
});

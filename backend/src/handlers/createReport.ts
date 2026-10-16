import { randomUUID } from "node:crypto";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "../lib/db";
import { handle, json, UserError } from "../lib/http";
import { logger } from "../lib/observability";
import { getRound } from "../lib/rounds";
import { readBody, requireRoundId, requireText, requireVoterId } from "../lib/validation";

// POST /rounds/{roundId}/reports { voterId, reason } → 201 { reported: true }. One report per voter per round.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  const body = readBody(event);
  const voterId = requireVoterId(body.voterId);
  const reason = requireText(body.reason, 300, "bad_reason", "Reasons");
  if (!(await getRound(roundId))) throw new UserError(404, "round_not_found", "That round doesn't exist.");
  const createdAt = new Date().toISOString();
  const reportId = randomUUID();
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE, Item: { PK: `ROUND#${roundId}`, SK: `REPORTER#${voterId}` }, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: TABLE, Item: { PK: `ROUND#${roundId}`, SK: `REPORT#${createdAt}#${reportId}`, reportId, voterId, reason, createdAt } } },
          { Put: { TableName: TABLE, Item: { PK: "REPORTS", SK: `${createdAt}#${roundId}#${reportId}`, roundId, reportId, voterId, reason, createdAt } } },
        ],
      }),
    );
  } catch (e) {
    if (e instanceof TransactionCanceledException && e.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed")
      throw new UserError(409, "already_reported", "You've already reported this round.");
    throw e;
  }
  logger.warn("Round reported", { roundId, reportId }); // WARN so reports stand out in the logs
  return json(201, { reported: true });
});

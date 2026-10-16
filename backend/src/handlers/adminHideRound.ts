import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "../lib/db";
import { handle, json, UserError } from "../lib/http";
import { logger } from "../lib/observability";
import { requireRoundId } from "../lib/validation";

// POST /admin/rounds/{roundId}/hide (IAM): removes a round from the replay feed and its public page. Idempotent.
export const handler = handle(async (event) => {
  const roundId = requireRoundId(event);
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `ROUND#${roundId}`, SK: "META" },
        UpdateExpression: "SET #h = :t REMOVE GSI1PK, GSI1SK",
        ExpressionAttributeNames: { "#h": "hidden" },
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: { ":t": true },
      }),
    );
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) throw new UserError(404, "round_not_found", "That round doesn't exist.");
    throw e;
  }
  logger.info("Round hidden", { roundId });
  return json(200, { hidden: true });
});

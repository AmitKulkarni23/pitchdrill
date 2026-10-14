import type { DynamoDBStreamEvent } from "aws-lambda";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { generateBriefs } from "../lib/briefs";
import { db, TABLE } from "../lib/db";
import { logger, metrics } from "../lib/observability";
import { MetricUnit } from "@aws-lambda-powertools/metrics";

// DynamoDB stream: INSERT of a round META → generate briefs and store them once.
// Never throws: failures are counted, and SlotTick retries and falls back (TASK-006).
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  try {
    for (const record of event.Records) {
      const keys = record.dynamodb?.Keys;
      if (record.eventName !== "INSERT" || keys?.SK?.S !== "META" || !keys.PK?.S) continue;
      const PK = keys.PK.S;
      try {
        const briefs = await generateBriefs();
        await db.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK, SK: "META" },
            UpdateExpression: "SET briefs = :b",
            ConditionExpression: "attribute_not_exists(briefs)",
            ExpressionAttributeValues: { ":b": briefs },
          }),
        );
        metrics.addMetric("BriefGenerated", MetricUnit.Count, 1);
      } catch (e) {
        if (e instanceof ConditionalCheckFailedException) continue; // briefs already stored
        logger.error("Brief generation failed", { pk: PK, error: (e as Error).message });
        metrics.addMetric("BriefGenerationFailed", MetricUnit.Count, 1);
      }
    }
  } finally {
    metrics.publishStoredMetrics();
  }
};

import type { Context, DynamoDBStreamEvent } from "aws-lambda";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { generateBriefs } from "../lib/briefs";
import { logger, metrics } from "../lib/observability";
import { saveBriefs } from "../lib/rounds";

// DynamoDB stream consumer: a new round META → generate its briefs. Never throws (no retry pile-up); SlotTick retries at T-5m.
export const handler = async (event: DynamoDBStreamEvent, context: Context) => {
  logger.addContext(context);
  try {
    await Promise.all(
      event.Records.filter((r) => r.eventName === "INSERT" && r.dynamodb?.Keys?.SK?.S === "META").map(async (r) => {
        const roundId = r.dynamodb?.NewImage?.roundId?.S;
        if (!roundId) return;
        try {
          const saved = await saveBriefs(roundId, await generateBriefs());
          metrics.addMetric("BriefGenerated", MetricUnit.Count, 1);
          logger.info("Briefs generated", { roundId, saved });
        } catch (e) {
          metrics.addMetric("BriefGenerationFailed", MetricUnit.Count, 1);
          logger.warn("Brief generation failed; SlotTick will retry", { roundId, error: (e as Error).message });
        }
      }),
    );
  } finally {
    metrics.publishStoredMetrics();
  }
};

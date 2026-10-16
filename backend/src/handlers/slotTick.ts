import type { Context } from "aws-lambda";
import { tick } from "../lib/lifecycle";
import { logger, metrics } from "../lib/observability";

// Invoked every minute by EventBridge Scheduler during slot hours. All logic lives in lib/lifecycle.ts.
export const handler = async (_event: unknown, context: Context) => {
  logger.addContext(context);
  try {
    await tick(Date.now());
  } catch (e) {
    logger.error("Tick failed", e as Error);
  } finally {
    metrics.publishStoredMetrics();
  }
};

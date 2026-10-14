import type { APIGatewayProxyResultV2, Context } from "aws-lambda";
import { logger, metrics } from "./observability";

/** An expected rejection whose message is safe to show the user. */
export class UserError extends Error {
  /** `extra` fields are merged into the error body (e.g. `availableAt`). */
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Wraps a handler: request-ID logging, `{ error }` responses, metrics flush. Unexpected errors become a generic 500. */
export const handle =
  <E>(fn: (event: E) => Promise<APIGatewayProxyResultV2>) =>
  async (event: E, context: Context): Promise<APIGatewayProxyResultV2> => {
    logger.addContext(context);
    try {
      return await fn(event);
    } catch (e) {
      if (e instanceof UserError) {
        logger.info("Request rejected", { code: e.code, status: e.status });
        return json(e.status, { error: { code: e.code, message: e.message, ...e.extra } });
      }
      logger.error("Unhandled error", e as Error);
      return json(500, { error: { code: "internal", message: "Something went wrong. Please try again." } });
    } finally {
      metrics.publishStoredMetrics();
    }
  };

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { logger, metrics } from "./observability";

/** An expected rejection whose message is safe to show the user. `details` are extra safe fields for the client. */
export class UserError extends Error {
  constructor(public status: number, public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message);
  }
}

export const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

/**
 * Wraps an API handler: request-ID logging, one "Request completed" line per request (route, status, latency),
 * `{ error }` responses, metrics flush. Unexpected errors are logged at ERROR and become a generic 500.
 */
export const handle =
  (fn: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>) =>
  async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
    logger.addContext(context);
    logger.appendKeys({ route: event.routeKey, apiRequestId: event.requestContext?.requestId });
    const started = Date.now();
    let result: APIGatewayProxyResultV2;
    try {
      result = await fn(event);
    } catch (e) {
      if (e instanceof UserError) {
        logger.info("Request rejected", { code: e.code, status: e.status });
        result = json(e.status, { error: { code: e.code, message: e.message, ...e.details } });
      } else {
        logger.error("Unhandled error", e as Error);
        result = json(500, { error: { code: "internal", message: "Something went wrong. Please try again." } });
      }
    } finally {
      metrics.publishStoredMetrics();
    }
    logger.info("Request completed", { status: typeof result === "object" ? result.statusCode : 200, latencyMs: Date.now() - started });
    logger.removeKeys(["route", "apiRequestId"]);
    return result;
  };

import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Tracer } from "@aws-lambda-powertools/tracer";

const serviceName = "pitchdrill";

/** JSON logs with the Lambda request ID on every line. */
export const logger = new Logger({ serviceName });
/** X-Ray subsegments for AWS SDK calls. Disabled automatically outside Lambda. */
export const tracer = new Tracer({ serviceName });
/** CloudWatch metrics via EMF, flushed at the end of each invocation by `handle()`. */
export const metrics = new Metrics({ serviceName, namespace: "PitchDrill" });

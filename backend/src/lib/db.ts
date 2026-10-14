import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { tracer } from "./observability";

// DYNAMODB_ENDPOINT points tests at DynamoDB Local; unset in Lambda.
export const db = DynamoDBDocumentClient.from(
  tracer.captureAWSv3Client(
    new DynamoDBClient(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  ),
);
export const TABLE = process.env.TABLE_NAME_ENV ?? "pitchdrill-main";

// Key layout: see docs/architecture.md ("DynamoDB Table").

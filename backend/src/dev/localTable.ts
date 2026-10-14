import { CreateTableCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "../lib/db";

/** (Re)creates the table in DynamoDB Local with the same keys and GSI as the CDK stack. */
export async function createLocalTable() {
  await db.send(new DeleteTableCommand({ TableName: TABLE })).catch(() => {});
  await db.send(
    new CreateTableCommand({
      TableName: TABLE,
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );
}

if (import.meta.main) {
  await createLocalTable();
  console.log("Created local table");
}

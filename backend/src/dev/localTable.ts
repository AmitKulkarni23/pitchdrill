import { CreateTableCommand, DeleteTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { db, TABLE } from "../lib/db";

/** (Re)creates pitchdrill-main in DynamoDB Local with the same keys and GSI1 as production. */
export async function createLocalTable() {
  if (!process.env.DYNAMODB_ENDPOINT) throw new Error("Refusing to recreate the table without DYNAMODB_ENDPOINT (DynamoDB Local).");
  await db.send(new DeleteTableCommand({ TableName: TABLE })).catch(() => {});
  await db.send(
    new CreateTableCommand({
      TableName: TABLE,
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }, { AttributeName: "SK", KeyType: "RANGE" }],
      AttributeDefinitions: ["PK", "SK", "GSI1PK", "GSI1SK"].map((AttributeName) => ({ AttributeName, AttributeType: "S" as const })),
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [{ AttributeName: "GSI1PK", KeyType: "HASH" }, { AttributeName: "GSI1SK", KeyType: "RANGE" }],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );
}

// `--keep` (used by `bun run dev`) leaves an existing table and its data alone.
const exists = () => db.send(new DescribeTableCommand({ TableName: TABLE })).then(() => true, () => false);
if (import.meta.main && !(process.argv.includes("--keep") && (await exists())))
  await createLocalTable().then(() => console.log(`Created ${TABLE} in DynamoDB Local`));

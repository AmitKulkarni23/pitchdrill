import { UserError } from "./http";

const KEY_FIELDS = new Set(["PK", "SK", "GSI1PK", "GSI1SK"]);

/** DynamoDB LastEvaluatedKey → opaque URL-safe cursor. */
export const encodeCursor = (key: Record<string, unknown> | undefined): string | undefined =>
  key ? Buffer.from(JSON.stringify(key)).toString("base64url") : undefined;

/** Cursor → ExclusiveStartKey. Anything that is not a small object of known string keys is a 400. */
export function decodeCursor(cursor: string | undefined): Record<string, string> | undefined {
  if (!cursor) return undefined;
  try {
    const key = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const entries = Object.entries(key ?? {});
    if (key && typeof key === "object" && entries.length > 0 && entries.every(([k, v]) => KEY_FIELDS.has(k) && typeof v === "string"))
      return key;
  } catch {
    // fall through
  }
  throw new UserError(400, "bad_cursor", "That page cursor isn't valid.");
}

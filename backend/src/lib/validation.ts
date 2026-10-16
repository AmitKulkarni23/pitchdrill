import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UserError } from "./http";

/** Parses a JSON object body; anything else is a 400. */
export function readBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  if (event.body && event.body.length > 10_000) throw new UserError(413, "too_large", "Request body is too large.");
  try {
    const raw = event.isBase64Encoded && event.body ? Buffer.from(event.body, "base64").toString() : event.body;
    const body = JSON.parse(raw || "{}");
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new UserError(400, "bad_json", "Request body must be a JSON object.");
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireVoterId(v: unknown): string {
  if (typeof v !== "string" || !UUID_V4.test(v)) throw new UserError(400, "bad_voter", "Missing or invalid voter ID.");
  return v.toLowerCase();
}

const NICKNAME = /^[A-Za-z0-9 _.\-]{2,20}$/;
export function requireNickname(v: unknown): string {
  const n = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!NICKNAME.test(n)) throw new UserError(400, "bad_nickname", "Nicknames are 2–20 letters, numbers, spaces or _ - .");
  return n;
}

export function requireText(v: unknown, max: number, code: string, label: string): string {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t || t.length > max) throw new UserError(400, code, `${label} must be 1–${max} characters.`);
  return t;
}

/** Route path params are validated before they reach a DynamoDB key. */
const ROUND_ID = /^[0-9a-f-]{36}$/;
export function requireRoundId(event: APIGatewayProxyEventV2): string {
  const id = event.pathParameters?.roundId;
  if (!id || !ROUND_ID.test(id)) throw new UserError(404, "round_not_found", "That round doesn't exist.");
  return id;
}

/** Opaque pagination cursor: base64url JSON of a DynamoDB key with only the expected string attributes. */
export const encodeCursor = (key: Record<string, unknown> | undefined) =>
  key ? Buffer.from(JSON.stringify(key)).toString("base64url") : undefined;

export function decodeCursor(cursor: string | undefined, keys: string[]): Record<string, string> | undefined {
  if (!cursor) return undefined;
  try {
    const obj = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (obj && typeof obj === "object" && Object.keys(obj).sort().join() === [...keys].sort().join() && keys.every((k) => typeof obj[k] === "string" && obj[k].length < 300))
      return obj;
  } catch {}
  throw new UserError(400, "bad_cursor", "That page link is invalid.");
}

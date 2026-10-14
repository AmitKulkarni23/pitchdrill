import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UserError } from "./http";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parses the JSON object body of a request. */
export function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try {
    const body = JSON.parse(event.body ?? "{}");
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  throw new UserError(400, "bad_json", "Request body must be a JSON object.");
}

/** The anonymous voter ID (random UUID v4 kept in the browser's localStorage). */
export function requireVoterId(body: Record<string, unknown>): string {
  if (typeof body.voterId !== "string" || !UUID_V4.test(body.voterId))
    throw new UserError(400, "bad_voter", "Missing or invalid voter ID.");
  return body.voterId;
}

const NICKNAME_RE = /^[A-Za-z0-9 _.-]{2,20}$/;

/** A trimmed nickname: 2-20 letters, numbers, spaces or `_-.`. */
export function requireNickname(body: Record<string, unknown>): string {
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (!NICKNAME_RE.test(nickname))
    throw new UserError(400, "bad_nickname", "Nicknames are 2–20 letters, numbers, spaces, dots, dashes or underscores.");
  return nickname;
}

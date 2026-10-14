// Single list of API routes. Read by the CDK stack (infra/lib/backend-stack.ts) and the local dev server (src/dev/server.ts).
// Plain data, no imports: the infra app loads this file directly.
export interface RouteDef {
  method: "GET" | "POST";
  /** API Gateway syntax, e.g. `/rounds/{roundId}`. */
  path: string;
  /** File name in src/handlers/ without extension. */
  handler: string;
  /** `public` inherits the stack default authorizer; `iam` always requires a SigV4-signed request. */
  auth: "public" | "iam";
  throttle?: { rateLimit: number; burstLimit: number };
}

export const routes: RouteDef[] = [
  { method: "GET", path: "/slots", handler: "listSlots", auth: "public", throttle: { rateLimit: 20, burstLimit: 40 } },
  { method: "POST", path: "/bookings", handler: "createBooking", auth: "public", throttle: { rateLimit: 10, burstLimit: 20 } },
  { method: "GET", path: "/ticket", handler: "getTicket", auth: "public", throttle: { rateLimit: 20, burstLimit: 40 } },
];

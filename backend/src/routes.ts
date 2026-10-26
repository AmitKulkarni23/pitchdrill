// Every API route, declared once. Read by the CDK stack (infra/lib/backend-stack.ts) and the dev server (src/dev/server.ts).
// Plain data, no imports, so infra can import it directly.

export interface Route {
  method: "GET" | "POST";
  path: string;
  /** File name in src/handlers/ without extension. */
  handler: string;
  auth: "public" | "iam";
  throttle?: { rateLimit: number; burstLimit: number };
}

const READ = { rateLimit: 20, burstLimit: 40 };
const WRITE = { rateLimit: 20, burstLimit: 40 };

export const routes: Route[] = [
  { method: "GET", path: "/slots", handler: "listSlots", auth: "public", throttle: READ },
  { method: "POST", path: "/bookings", handler: "createBooking", auth: "public", throttle: { rateLimit: 10, burstLimit: 20 } },
  { method: "GET", path: "/ticket", handler: "getTicket", auth: "public", throttle: READ },
  { method: "GET", path: "/rounds/live", handler: "listLiveRounds", auth: "public", throttle: READ },
  { method: "GET", path: "/rounds/{roundId}", handler: "getRound", auth: "public", throttle: READ },
  { method: "GET", path: "/rounds/{roundId}/brief", handler: "getBrief", auth: "public", throttle: READ },
  { method: "POST", path: "/rounds/{roundId}/join", handler: "joinRound", auth: "public", throttle: WRITE },
  { method: "POST", path: "/rounds/{roundId}/watch", handler: "watchRound", auth: "public", throttle: WRITE },
  { method: "POST", path: "/rounds/{roundId}/chat-token", handler: "createChatToken", auth: "public", throttle: WRITE },
  { method: "POST", path: "/rounds/{roundId}/votes", handler: "castVote", auth: "public", throttle: WRITE },
  { method: "GET", path: "/replays", handler: "listReplays", auth: "public", throttle: READ },
  { method: "GET", path: "/rounds/{roundId}/comments", handler: "listComments", auth: "public", throttle: READ },
  { method: "POST", path: "/rounds/{roundId}/comments", handler: "createComment", auth: "public", throttle: WRITE },
  { method: "POST", path: "/rounds/{roundId}/reports", handler: "createReport", auth: "public", throttle: { rateLimit: 5, burstLimit: 10 } },
  { method: "POST", path: "/contact", handler: "createContact", auth: "public", throttle: { rateLimit: 1, burstLimit: 5 } },
  { method: "POST", path: "/admin/rounds/{roundId}/end", handler: "adminEndRound", auth: "iam" },
  { method: "POST", path: "/admin/rounds/{roundId}/hide", handler: "adminHideRound", auth: "iam" },
];

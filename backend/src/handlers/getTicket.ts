import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getBookingByTicket } from "../lib/bookings";
import { handle, json } from "../lib/http";

// GET /ticket with header `x-ticket` (kept out of the URL so it never lands in access logs) → { booking }
export const handler = handle(async (event: APIGatewayProxyEventV2) =>
  json(200, { booking: await getBookingByTicket(event.headers["x-ticket"]) }),
);

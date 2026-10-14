import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createBooking } from "../lib/bookings";
import { handle, json, UserError } from "../lib/http";

// POST /bookings  { slotId, handle, role } → 201 { ticket, booking }
export const handler = handle(async (event: APIGatewayProxyEventV2) => {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    throw new UserError(400, "bad_json", "Request body must be JSON.");
  }
  return json(201, await createBooking({ slotId: body.slotId, handle: body.handle, role: body.role }));
});

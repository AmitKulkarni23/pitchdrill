import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createBooking } from "../lib/bookings";
import { handle, json } from "../lib/http";
import { parseBody } from "../lib/validation";

// POST /bookings  { slotId, handle, role } → 201 { ticket, booking }
export const handler = handle(async (event: APIGatewayProxyEventV2) => {
  const body = parseBody(event);
  return json(201, await createBooking({ slotId: body.slotId, handle: body.handle, role: body.role }));
});

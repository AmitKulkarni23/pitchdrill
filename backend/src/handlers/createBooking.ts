import { createBooking } from "../lib/bookings";
import { handle, json } from "../lib/http";
import { readBody } from "../lib/validation";

// POST /bookings  { slotId, handle, role } → 201 { ticket, booking } (the ticket is returned only here, once)
export const handler = handle(async (event) => {
  const body = readBody(event);
  return json(201, await createBooking({ slotId: body.slotId, handle: body.handle, role: body.role }));
});

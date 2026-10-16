import { beforeAll, describe, expect, test } from "bun:test";
import { createLocalTable } from "../src/dev/localTable";
import { createBooking } from "../src/lib/bookings";
import { slotsWithStats } from "../src/lib/slotStats";
import { bookableSlots } from "../src/lib/slots";

const NOW = Date.parse("2098-06-01T12:00:00.000Z");

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("slotsWithStats", () => {
  beforeAll(createLocalTable);

  test("returns zeros for every bookable slot, then merges counts for a booked one", async () => {
    const empty = await slotsWithStats(NOW);
    expect(empty.map((s) => s.slotId)).toEqual(bookableSlots(NOW));
    expect(empty[0]).toEqual({ slotId: empty[0]!.slotId, sellers: 0, buyers: 0, waitingSellers: 0, waitingBuyers: 0, rounds: 0 });

    const slot = empty[3]!.slotId;
    await createBooking({ slotId: slot, handle: "zed", role: "seller" }, NOW);
    await createBooking({ slotId: slot, handle: "zoe", role: "seller" }, NOW + 1);
    await createBooking({ slotId: slot, handle: "ann", role: "buyer" }, NOW + 2);
    const after = await slotsWithStats(NOW);
    expect(after[3]).toEqual({ slotId: slot, sellers: 2, buyers: 1, waitingSellers: 1, waitingBuyers: 0, rounds: 1 });
    expect(after[2]!.sellers).toBe(0);
  });
});

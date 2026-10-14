// Runs against DynamoDB Local; skipped unless DYNAMODB_ENDPOINT is set (see CLAUDE.md).
import { beforeAll, describe, expect, test } from "bun:test";
import { createLocalTable } from "../src/dev/localTable";
import { createBooking } from "../src/lib/bookings";
import { slotsWithStats } from "../src/lib/slotStats";
import { bookableSlots } from "../src/lib/slots";

const NOW = Date.parse("2099-01-01T12:00:00.000Z");

describe.skipIf(!process.env.DYNAMODB_ENDPOINT)("slotsWithStats", () => {
  beforeAll(createLocalTable);

  test("given no STATS items, returns zeros for every bookable slot", async () => {
    const result = await slotsWithStats(NOW);
    const ids = bookableSlots(NOW);
    expect(ids.length).toBeGreaterThan(100); // exercises more than one BatchGetItem chunk
    expect(result.map((s) => s.slotId)).toEqual(ids);
    expect(result.every((s) => s.waitingSellers === 0 && s.waitingBuyers === 0 && s.rounds === 0)).toBe(true);
  });

  test("given STATS for one slot, merges counts onto that slot only", async () => {
    const target = bookableSlots(NOW)[3]!;
    await createBooking({ slotId: target, handle: "stat_s1", role: "seller" }, NOW);
    await createBooking({ slotId: target, handle: "stat_s2", role: "seller" }, NOW + 1);
    await createBooking({ slotId: target, handle: "stat_b1", role: "buyer" }, NOW + 2);
    const result = await slotsWithStats(NOW);
    for (const s of result)
      expect(s).toEqual(
        s.slotId === target
          ? { slotId: target, waitingSellers: 1, waitingBuyers: 0, rounds: 1 }
          : { slotId: s.slotId, waitingSellers: 0, waitingBuyers: 0, rounds: 0 },
      );
  });
});

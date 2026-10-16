import { BatchGetCommand, type BatchGetCommandOutput } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "./db";
import { bookableSlots } from "./slots";

const COUNTS = ["sellers", "buyers", "waitingSellers", "waitingBuyers", "rounds"] as const;
export type SlotWithStats = { slotId: string } & Record<(typeof COUNTS)[number], number>;

/** Every bookable slot with its seat and queue counts (zeros where nobody has booked). */
export async function slotsWithStats(now: number): Promise<SlotWithStats[]> {
  const slots = bookableSlots(now);
  const stats = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < slots.length; i += 100) {
    let keys: Record<string, unknown>[] | undefined = slots.slice(i, i + 100).map((s) => ({ PK: `SLOT#${s}`, SK: "STATS" }));
    for (let attempt = 0; keys?.length; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      if (attempt > 5) throw new Error("BatchGet kept returning UnprocessedKeys");
      const res: BatchGetCommandOutput = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: keys } } }));
      for (const item of res.Responses?.[TABLE] ?? []) stats.set((item.PK as string).slice(5), item);
      keys = res.UnprocessedKeys?.[TABLE]?.Keys;
    }
  }
  return slots.map((slotId) => {
    const s = stats.get(slotId);
    return { slotId, ...(Object.fromEntries(COUNTS.map((c) => [c, Math.max(0, Number(s?.[c] ?? 0))])) as Record<(typeof COUNTS)[number], number>) };
  });
}

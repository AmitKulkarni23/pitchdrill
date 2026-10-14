import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE } from "./db";
import { slotPk, STATS_SK } from "./keys";
import { bookableSlots } from "./slots";

export interface SlotWithStats {
  slotId: string;
  waitingSellers: number;
  waitingBuyers: number;
  rounds: number;
}

const BATCH_SIZE = 100;
const MAX_RETRIES = 5;

/** Reads one chunk of STATS items, retrying UnprocessedKeys with a short backoff. */
async function batchGetStats(slotIds: string[]) {
  const found: Record<string, any>[] = [];
  let keys: Record<string, any>[] = slotIds.map((id) => ({ PK: slotPk(id), SK: STATS_SK }));
  for (let attempt = 0; keys.length > 0; attempt++) {
    if (attempt > MAX_RETRIES) throw new Error("BatchGetItem left unprocessed keys");
    if (attempt > 0) await new Promise((r) => setTimeout(r, 25 * 2 ** attempt));
    const out = await db.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: keys } } }));
    found.push(...(out.Responses?.[TABLE] ?? []));
    keys = out.UnprocessedKeys?.[TABLE]?.Keys ?? [];
  }
  return found;
}

/** Every bookable slot, soonest first, with its waiting counts (zeros when it has no STATS item). */
export async function slotsWithStats(now: number): Promise<SlotWithStats[]> {
  const ids = bookableSlots(now);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) chunks.push(ids.slice(i, i + BATCH_SIZE));
  const stats = new Map<string, Record<string, any>>();
  for (const items of await Promise.all(chunks.map(batchGetStats)))
    for (const item of items) stats.set(item.PK.slice("SLOT#".length), item);
  return ids.map((slotId) => {
    const s = stats.get(slotId);
    return {
      slotId,
      waitingSellers: Math.max(0, s?.waitingSellers ?? 0),
      waitingBuyers: Math.max(0, s?.waitingBuyers ?? 0),
      rounds: s?.rounds ?? 0,
    };
  });
}

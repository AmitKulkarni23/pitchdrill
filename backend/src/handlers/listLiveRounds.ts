import { handle, json } from "../lib/http";
import { roundsOfSlot, toPublicRound } from "../lib/rounds";
import { pacificDate, slotsForDate } from "../lib/slots";

const MIN = 60_000;

// GET /rounds/live → { rounds } that are ready or live in the current slot (T-5m … T+5m).
export const handler = handle(async () => {
  const now = Date.now();
  const slots = slotsForDate(pacificDate(now)).filter((s) => Math.abs(Date.parse(s) - now) <= 5 * MIN);
  const rounds = (await Promise.all(slots.map(roundsOfSlot))).flat().filter((r) => !r.hidden && (r.status === "ready" || r.status === "live"));
  return json(200, { rounds: rounds.map(toPublicRound) });
});

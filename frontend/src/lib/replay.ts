import type { PublicRound } from "@/types/api";

export type ReplayState = "playing" | "processing" | "cancelled" | "unavailable";

/** What the replay page shows for a round (null = it could not be loaded / does not exist). */
export function replayState(round: PublicRound | null): ReplayState {
  if (!round) return "unavailable";
  if (round.status === "cancelled") return "cancelled";
  if (round.replayUrl) return "playing";
  return "processing";
}

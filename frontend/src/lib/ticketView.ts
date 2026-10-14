import type { Booking, PublicRound } from "@/types/api";

export type TicketView =
  | { kind: "waiting" }
  | { kind: "no_opponent" }
  | { kind: "loading_round" }
  | { kind: "opens_soon" }
  | { kind: "enter_arena" }
  | { kind: "cancelled"; message: string }
  | { kind: "replay"; roundId: string };

/** Maps the booking and its round (if any) to what the ticket page shows. */
export function ticketView(booking: Booking, round: PublicRound | undefined): TicketView {
  if (booking.status === "no_opponent") return { kind: "no_opponent" };
  if (!booking.roundId) return { kind: "waiting" };
  if (!round) return { kind: "loading_round" };
  switch (round.status) {
    case "paired":
      return { kind: "opens_soon" };
    case "ready":
    case "live":
      return { kind: "enter_arena" };
    case "cancelled":
      return { kind: "cancelled", message: round.cancelReason === "admin" ? "Round cancelled." : "Your opponent didn't show." };
    case "ended":
    case "closed":
      return { kind: "replay", roundId: round.roundId };
  }
}

/** How often to re-fetch, or null when nothing more will change. */
export function pollInterval(booking: Booking, round: PublicRound | undefined): number | null {
  if (booking.status === "no_opponent") return null;
  if (!booking.roundId) return 30_000;
  if (!round || round.status === "paired") return 15_000;
  if (round.status === "ready" || round.status === "live") return 5_000;
  return null;
}

// Mirrors docs/system_specs/architecture.md §5. ponytail: hand-synced with the backend; share a package if they drift.

export type Role = "seller" | "buyer";

export interface SlotWithStats {
  slotId: string;
  sellers: number;
  buyers: number;
  waitingSellers: number;
  waitingBuyers: number;
  rounds: number;
}

export interface Booking {
  slotId: string;
  bookingId: string;
  handle: string;
  role: Role;
  createdAt: string;
  status?: "waiting" | "paired" | "no_opponent";
  roundId?: string;
  opponentHandle?: string;
}

export interface CreateBookingResponse {
  ticket: string;
  booking: Booking;
}

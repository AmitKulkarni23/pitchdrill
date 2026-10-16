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

export type RoundStatus = "paired" | "ready" | "live" | "cancelled" | "ended" | "closed";

export interface Product {
  name: string;
  price: string;
  tagline: string;
}

/** GET /rounds/{roundId}, /rounds/live, /replays. Never contains briefs. */
export interface PublicRound {
  roundId: string;
  slotId: string;
  status: RoundStatus;
  sellerHandle: string;
  buyerHandle: string;
  startedAt?: string;
  endsAt?: string;
  endedAt?: string;
  cancelReason?: "no_show" | "admin";
  votesSold: number;
  votesNotSold: number;
  product?: Product;
  /** Seller sheet from live on; buyer persona only after the buzzer. */
  briefs?: { seller: string; buyer?: string };
  replayUrl?: string;
}

export interface ChatToken {
  token: string;
  sessionExpirationTime?: string;
  tokenExpirationTime?: string;
}

export interface JoinResponse {
  role: Role;
  stageToken: string;
  chatToken: ChatToken;
  round: PublicRound;
}

export interface BriefResponse {
  role: Role;
  product: Product;
  brief: string;
}

export interface Comment {
  commentId: string;
  nickname: string;
  text: string;
  createdAt: string;
}

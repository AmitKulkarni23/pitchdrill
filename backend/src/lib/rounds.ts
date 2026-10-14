import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getBookingByTicket } from "./bookings";
import { db, TABLE } from "./db";
import { UserError } from "./http";
import { roundPk } from "./keys";
import { roundsOf, type Round } from "./lifecycle/shared";
import { pacificDate, slotsForDate } from "./slots";
import { createChatToken, createStageToken } from "./ivs";

const MIN = 60_000;
const BRIEF_REVEAL_BEFORE_MS = 30_000;

export interface PublicRound {
  roundId: string;
  slotId: string;
  status: string;
  sellerHandle: string;
  buyerHandle: string;
  startedAt?: string;
  endedAt?: string;
  cancelReason?: string;
  votesSold: number;
  votesNotSold: number;
  replayUrl?: string;
}

/** Explicit allowlist: briefs, booking IDs and ARNs must never reach the public shape. */
export function toPublicRound(meta: Round): PublicRound {
  const domain = process.env.RECORDINGS_CDN_DOMAIN_ENV;
  return {
    roundId: meta.roundId,
    slotId: meta.slotId,
    status: meta.status,
    sellerHandle: meta.sellerHandle,
    buyerHandle: meta.buyerHandle,
    ...(meta.startedAt && { startedAt: meta.startedAt }),
    ...(meta.endedAt && { endedAt: meta.endedAt }),
    ...(meta.cancelReason && { cancelReason: meta.cancelReason }),
    votesSold: meta.votesSold ?? 0,
    votesNotSold: meta.votesNotSold ?? 0,
    ...(meta.recordingPath && domain && { replayUrl: `https://${domain}/${meta.recordingPath}` }),
  };
}

/** The round's META item. Missing and hidden rounds are both "not found". */
export async function getRoundMeta(roundId: string): Promise<Round> {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: roundPk(roundId), SK: "META" } }));
  if (!Item || Item.hidden) throw new UserError(404, "round_not_found", "That round doesn't exist.");
  return Item;
}

/** Rounds that spectators can watch now: ready/live rounds of slots with T-5m <= now <= T+5m. */
export async function liveRounds(now: number): Promise<PublicRound[]> {
  const dates = [pacificDate(now - 24 * 60 * MIN), pacificDate(now)];
  const slots = dates.flatMap(slotsForDate).filter((id) => {
    const t = Date.parse(id);
    return t - 5 * MIN <= now && now <= t + 5 * MIN;
  });
  const rounds = (await Promise.all(slots.map(roundsOf))).flat();
  return rounds.filter((r) => (r.status === "ready" || r.status === "live") && !r.hidden).map(toPublicRound);
}

/** Resolves a ticket to its side of a round, or 403s when the ticket belongs to someone else. */
async function sideOf(ticket: unknown, roundId: string) {
  const booking = await getBookingByTicket(ticket);
  const meta = await getRoundMeta(roundId);
  if (booking.roundId !== roundId || (booking.bookingId !== meta.sellerBookingId && booking.bookingId !== meta.buyerBookingId))
    throw new UserError(403, "not_your_round", "That ticket isn't for this round.");
  return { booking, meta, role: booking.role };
}

/** The ticket holder's own brief, from T-30s. The other side's brief is never returned. */
export async function getBrief(ticket: unknown, roundId: string, now = Date.now()) {
  const { meta, role } = await sideOf(ticket, roundId);
  const availableAt = Date.parse(meta.slotId) - BRIEF_REVEAL_BEFORE_MS;
  if (now < availableAt)
    throw new UserError(403, "brief_not_yet", "Your brief unlocks 30 seconds before the round.", { availableAt: new Date(availableAt).toISOString() });
  if (!meta.briefs) throw new UserError(503, "brief_pending", "Your brief is still being prepared. Try again in a moment.");
  return { product: meta.briefs.product, brief: role === "seller" ? meta.briefs.seller : meta.briefs.buyer, role };
}

function requireJoinable(meta: Round) {
  if ((meta.status !== "ready" && meta.status !== "live") || !meta.stageArn)
    throw new UserError(409, "round_not_joinable", "This round isn't open right now.", { status: meta.status });
}

/** Ticket holder → publish+subscribe stage token and a receive-only chat token. */
export async function joinRound(ticket: unknown, roundId: string) {
  const { booking, meta, role } = await sideOf(ticket, roundId);
  requireJoinable(meta);
  const [stageToken, chatToken] = await Promise.all([
    createStageToken({
      stageArn: meta.stageArn,
      userId: booking.bookingId,
      attributes: { handle: booking.handle, role, order: role === "seller" ? "1" : "2" },
      capabilities: ["PUBLISH", "SUBSCRIBE"],
    }),
    createChatToken({
      roomIdentifier: meta.chatRoomArn,
      userId: booking.bookingId,
      capabilities: [],
      attributes: { nickname: booking.handle, role },
    }),
  ]);
  return { stageToken, chatToken };
}

/** Anyone → subscribe-only stage token. */
export async function watchRound(roundId: string, voterId: string) {
  const meta = await getRoundMeta(roundId);
  requireJoinable(meta);
  const stageToken = await createStageToken({
    stageArn: meta.stageArn,
    userId: `viewer-${voterId}`,
    attributes: {},
    capabilities: ["SUBSCRIBE"],
  });
  return { stageToken };
}

/** Spectator → chat token that can send messages under their nickname. */
export async function spectatorChatToken(roundId: string, voterId: string, nickname: string) {
  const meta = await getRoundMeta(roundId);
  if (!["ready", "live", "ended"].includes(meta.status) || !meta.chatRoomArn)
    throw new UserError(409, "chat_closed", "Chat isn't open for this round.", { status: meta.status });
  const lower = nickname.toLowerCase();
  if (lower === String(meta.sellerHandle).toLowerCase() || lower === String(meta.buyerHandle).toLowerCase())
    throw new UserError(409, "nickname_taken", "That nickname belongs to a player in this round. Pick another.");
  return createChatToken({
    roomIdentifier: meta.chatRoomArn,
    userId: `viewer-${voterId}`,
    capabilities: ["SEND_MESSAGE"],
    attributes: { nickname },
    sessionDurationInMinutes: 60,
  });
}

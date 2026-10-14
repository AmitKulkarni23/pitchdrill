import { expect, test } from "bun:test";
import type { Booking, PublicRound } from "@/types/api";
import { pollInterval, ticketView } from "./ticketView";

const booking = (extra: Partial<Booking> = {}): Booking => ({
  slotId: "2026-10-15T00:00:00.000Z",
  bookingId: "b",
  handle: "amit",
  role: "seller",
  createdAt: "2026-10-14T00:00:00.000Z",
  status: "waiting",
  ...extra,
});
const round = (extra: Partial<PublicRound> = {}): PublicRound => ({
  roundId: "r1",
  slotId: "2026-10-15T00:00:00.000Z",
  status: "paired",
  sellerHandle: "amit",
  buyerHandle: "riya",
  votesSold: 0,
  votesNotSold: 0,
  ...extra,
});
const paired = booking({ status: "paired", roundId: "r1", opponentHandle: "riya" });

test("ticketView: waiting booking should return waiting view", () => {
  expect(ticketView(booking(), undefined)).toEqual({ kind: "waiting" });
});
test("ticketView: no_opponent should return no-opponent view", () => {
  expect(ticketView(booking({ status: "no_opponent" }), undefined)).toEqual({ kind: "no_opponent" });
});
test("ticketView: paired without a fetched round should load, paired round should wait for the arena", () => {
  expect(ticketView(paired, undefined).kind).toBe("loading_round");
  expect(ticketView(paired, round()).kind).toBe("opens_soon");
});
test("ticketView: round ready or live should return enter-arena view", () => {
  expect(ticketView(paired, round({ status: "ready" })).kind).toBe("enter_arena");
  expect(ticketView(paired, round({ status: "live" })).kind).toBe("enter_arena");
});
test("ticketView: cancelled no_show vs admin should return different messages", () => {
  const noShow = ticketView(paired, round({ status: "cancelled", cancelReason: "no_show" }));
  const admin = ticketView(paired, round({ status: "cancelled", cancelReason: "admin" }));
  expect(noShow).toEqual({ kind: "cancelled", message: "Your opponent didn't show." });
  expect(admin).toEqual({ kind: "cancelled", message: "Round cancelled." });
});
test("ticketView: ended and closed should link to the replay", () => {
  expect(ticketView(paired, round({ status: "ended" }))).toEqual({ kind: "replay", roundId: "r1" });
  expect(ticketView(paired, round({ status: "closed" }))).toEqual({ kind: "replay", roundId: "r1" });
});
test("pollInterval: should be 30s unpaired, 15s paired, 5s ready, none when ended", () => {
  expect(pollInterval(booking(), undefined)).toBe(30_000);
  expect(pollInterval(paired, undefined)).toBe(15_000);
  expect(pollInterval(paired, round())).toBe(15_000);
  expect(pollInterval(paired, round({ status: "ready" }))).toBe(5_000);
  expect(pollInterval(paired, round({ status: "live" }))).toBe(5_000);
  expect(pollInterval(paired, round({ status: "ended" }))).toBeNull();
  expect(pollInterval(paired, round({ status: "cancelled" }))).toBeNull();
  expect(pollInterval(booking({ status: "no_opponent" }), undefined)).toBeNull();
});

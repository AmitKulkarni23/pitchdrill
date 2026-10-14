import { expect, test } from "bun:test";
import type { PublicRound } from "@/types/api";
import { replayState } from "./replay";

const round = (extra: Partial<PublicRound> = {}): PublicRound => ({
  roundId: "r",
  slotId: "s",
  status: "ended",
  sellerHandle: "a",
  buyerHandle: "b",
  votesSold: 0,
  votesNotSold: 0,
  ...extra,
});

test("replayState: should map round to playing / processing / cancelled / unavailable", () => {
  expect(replayState(null)).toBe("unavailable");
  expect(replayState(round({ status: "cancelled" }))).toBe("cancelled");
  expect(replayState(round({ replayUrl: "https://cdn/x.m3u8" }))).toBe("playing");
  expect(replayState(round())).toBe("processing");
});

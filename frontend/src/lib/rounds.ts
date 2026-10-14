import type { PublicRound } from "@/types/api";

/** "@amit vs @riya · live" / "starting soon" for the Live now list. */
export const liveRoundLabel = (r: Pick<PublicRound, "sellerHandle" | "buyerHandle" | "status">): string =>
  `@${r.sellerHandle} vs @${r.buyerHandle} · ${r.status === "live" ? "live" : "starting soon"}`;

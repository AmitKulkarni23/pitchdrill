import { Box, Typography } from "@mui/material";
import { countdown } from "@/lib/slots";
import { hall } from "@/config/tokens";

// ponytail: local shape until GET /rounds/live (TASK-009) defines it; the product name must be public there.
export interface LiveRound {
  roundId: string;
  product: string;
  sellerHandle: string;
  buyerHandle: string;
  endsAt: number;
}

const initials = (handle: string) => handle.slice(0, 2).toUpperCase();

const pill = { position: "absolute", px: 1, py: 0.5, borderRadius: 999, fontSize: 13, fontWeight: 700, lineHeight: 1.2 } as const;
const nameTag = { position: "absolute", bottom: 10, px: 1, py: 0.5, borderRadius: "6px", bgcolor: "rgba(255,255,255,0.94)", fontSize: 12, fontWeight: 600 } as const;

function Side({ handle, bg, ink }: { handle: string; bg: string; ink: string }) {
  return (
    <Box sx={{ bgcolor: bg, display: "grid", placeItems: "center" }}>
      <Box aria-hidden sx={{ width: { xs: 48, sm: 56 }, height: { xs: 48, sm: 56 }, borderRadius: "50%", bgcolor: "#fff", color: ink, display: "grid", placeItems: "center", fontWeight: 800 }}>
        {initials(handle)}
      </Box>
    </Box>
  );
}

/** One live round: seller left, buyer right, time left, product below. Opens the round's watch page. */
export function LiveTile({ round, now }: { round: LiveRound; now: number }) {
  const left = countdown(round.endsAt - now);
  return (
    <Box
      component="a"
      href={`/r/${round.roundId}`}
      aria-label={`Watch @${round.sellerHandle} sell ${round.product} to @${round.buyerHandle}, live, ${left} left`}
      sx={{ display: "grid", gap: 1.25, textDecoration: "none", color: hall.ink, "&:hover .frame, &:focus-visible .frame": { boxShadow: `0 0 0 2px ${hall.green}` } }}
    >
      <Box className="frame" sx={{ position: "relative", aspectRatio: "16 / 10", borderRadius: "12px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", bgcolor: "#fff", transition: "box-shadow 160ms" }}>
        <Side handle={round.sellerHandle} bg={hall.seller} ink={hall.sellerInk} />
        <Side handle={round.buyerHandle} bg={hall.buyer} ink={hall.buyerInk} />
        <Box sx={{ ...pill, top: 10, left: 10, display: "flex", alignItems: "center", gap: 0.75, bgcolor: "#fff", color: hall.live, fontWeight: 800, letterSpacing: "0.04em", fontSize: 12 }}>
          <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: hall.live }} />
          LIVE
        </Box>
        <Box sx={{ ...pill, top: 10, right: 10, bgcolor: hall.ink, color: "#fff" }}>{left} left</Box>
        <Box sx={{ ...nameTag, left: 10 }}>Seller @{round.sellerHandle}</Box>
        <Box sx={{ ...nameTag, right: 10 }}>Buyer @{round.buyerHandle}</Box>
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{round.product}</Typography>
    </Box>
  );
}

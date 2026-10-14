"use client";

import { Box, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import type { Booking, PublicRound } from "@/types/api";

interface Props {
  ticket: string;
  booking: Booking;
  round: PublicRound;
}

/** Placeholder until the participant arena (TASK-017) replaces it. */
export function Arena({ round }: Props) {
  return (
    <Box sx={{ bgcolor: studio.cobaltDeep, border: `2px solid ${studio.cobaltLine}`, p: 3 }}>
      <Typography sx={{ ...strapType, fontSize: "1.5rem" }}>The arena is opening</Typography>
      <Typography sx={{ color: studio.haze, mt: 1 }}>
        Round {round.roundId.slice(0, 8)} is {round.status}.
      </Typography>
    </Box>
  );
}

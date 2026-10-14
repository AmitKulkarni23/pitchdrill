"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { liveRoundLabel } from "@/lib/rounds";
import type { PublicRound } from "@/types/api";

/** Rounds spectators can watch right now. Renders nothing when there are none. */
export function LiveNow() {
  const [rounds, setRounds] = useState<PublicRound[]>([]);
  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ rounds: PublicRound[] }>("/rounds/live");
      setRounds(res.rounds);
    } catch {
      // Hidden when the API is unreachable or closed.
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);
  usePolling(refresh, 15_000);

  if (!rounds.length) return null;
  return (
    <Box component="section" aria-labelledby="live-title" sx={{ px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto", pt: { xs: 5, md: 7 } }}>
      <Typography id="live-title" variant="h2" sx={{ mb: 2 }}>
        <Box component="span" sx={{ bgcolor: studio.onAir, color: "#fff", px: 1, mr: 1.5, fontSize: "0.6em", verticalAlign: "middle" }}>LIVE</Box>
        Live now
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
        {rounds.map((r) => (
          <Box component="li" key={r.roundId}>
            <Box component="a" href={`/watch/${r.roundId}`} sx={{ ...strapType, fontSize: "1.25rem", color: "#fff", textDecoration: "underline" }}>
              {liveRoundLabel(r)}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

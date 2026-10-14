"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import { useTimeZone } from "@/hooks/useClock";
import { api } from "@/lib/api";
import { appendPage } from "@/lib/pagination";
import { timeLabel } from "@/lib/slots";
import type { PublicRound } from "@/types/api";

/** Recent replays, newest first. Renders nothing until there is at least one. */
export function RecentReplays() {
  const timeZone = useTimeZone();
  const [replays, setReplays] = useState<PublicRound[]>([]);
  const [cursor, setCursor] = useState<string>();

  const load = useCallback(async (from?: string) => {
    try {
      const res = await api.get<{ replays: PublicRound[]; nextCursor?: string }>(`/replays${from ? `?cursor=${encodeURIComponent(from)}` : ""}`);
      setReplays((prev) => appendPage(prev, res.replays, (r) => r.roundId));
      setCursor(res.nextCursor);
    } catch {
      // Hidden when the API is unreachable or closed.
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!replays.length || !timeZone) return null;
  return (
    <Box component="section" aria-labelledby="replays-title" sx={{ px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto", py: { xs: 5, md: 7 } }}>
      <Typography id="replays-title" variant="h2" sx={{ mb: 2 }}>Recent replays</Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.5 }}>
        {replays.map((r) => (
          <Box component="li" key={r.roundId}>
            <Box component="a" href={`/r/${r.roundId}`} sx={{ color: "inherit", textDecoration: "none", display: "flex", gap: 2, flexWrap: "wrap", alignItems: "baseline" }}>
              <Box component="span" sx={{ ...strapType, fontSize: "1.25rem", textDecoration: "underline" }}>@{r.sellerHandle} vs @{r.buyerHandle}</Box>
              <Box component="span" sx={{ color: studio.haze }}>
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(Date.parse(r.slotId))} · {timeLabel(r.slotId, timeZone)}
              </Box>
              <Box component="span" sx={{ color: studio.signal }}>Sold {r.votesSold}</Box>
              <Box component="span" sx={{ color: studio.haze }}>Not sold {r.votesNotSold}</Box>
            </Box>
          </Box>
        ))}
      </Box>
      {cursor && <Button variant="outlined" onClick={() => void load(cursor)} sx={{ mt: 2 }}>Load more</Button>}
    </Box>
  );
}

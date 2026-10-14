"use client";

import { useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import { api, ApiError } from "@/lib/api";
import { getRememberedVote, getVoterId, rememberVote } from "@/lib/storage";
import { votePercent, type Tally } from "@/lib/votes";

interface Props {
  roundId: string;
  tally: Tally;
  onTally: (tally: Tally) => void;
}

/** Sold / Not sold buttons (one vote per browser) and the always-visible tally. Reused on the replay page. */
export function VotePanel({ roundId, tally, onTally }: Props) {
  const [voted, setVoted] = useState(() => getRememberedVote(roundId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = votePercent(tally);

  async function vote(choice: "sold" | "not_sold") {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ votesSold: number; votesNotSold: number }>(`/rounds/${roundId}/votes`, { voterId: getVoterId(), vote: choice });
      rememberVote(roundId, choice);
      setVoted(choice);
      onTally({ sold: res.votesSold, notSold: res.votesNotSold });
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_voted") {
        setVoted(getRememberedVote(roundId) ?? choice);
        if (typeof e.details.votesSold === "number" && typeof e.details.votesNotSold === "number")
          onTally({ sold: e.details.votesSold, notSold: e.details.votesNotSold });
      } else setError(e instanceof Error ? e.message : "Couldn't record your vote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 2, maxWidth: 560 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        <Button variant="contained" size="large" disabled={busy || voted !== null} onClick={() => void vote("sold")} aria-pressed={voted === "sold"}>
          Sold
        </Button>
        <Button variant="outlined" size="large" disabled={busy || voted !== null} onClick={() => void vote("not_sold")} aria-pressed={voted === "not_sold"}>
          Not sold
        </Button>
      </Box>
      {voted && <Typography sx={{ color: studio.haze }}>You voted {voted === "sold" ? "Sold" : "Not sold"}.</Typography>}
      <Box aria-live="polite" sx={{ display: "grid", gap: 0.75 }}>
        {(
          [
            ["Sold", tally.sold, pct.sold, studio.signal],
            ["Not sold", tally.notSold, pct.notSold, studio.cyan],
          ] as const
        ).map(([label, count, percent, color]) => (
          <Box key={label}>
            <Box sx={{ ...strapType, display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span>{label}</span>
              <span>{count} · {percent}%</span>
            </Box>
            <Box sx={{ height: 10, bgcolor: studio.cobaltNight }}>
              <Box sx={{ height: "100%", bgcolor: color, transformOrigin: "left", transform: `scaleX(${percent / 100})`, transition: "transform 300ms ease-out" }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

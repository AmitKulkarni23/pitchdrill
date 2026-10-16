"use client";

import { useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { getVoterId } from "@/lib/storage";
import { hall, panel } from "@/config/tokens";
import type { PublicRound } from "@/types/api";

type Tally = { votesSold: number; votesNotSold: number };

/** "Sold" / "Not sold", once per browser, from the buzzer on (replays too). Shows the tally always. */
export function VotePanel({ round, tally, onTally }: { round: PublicRound; tally: Tally; onTally: (t: Tally) => void }) {
  const [voted, setVoted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = round.status === "ended" || round.status === "closed";
  const total = tally.votesSold + tally.votesNotSold;
  const pct = total ? Math.round((tally.votesSold / total) * 100) : 0;

  async function vote(v: "sold" | "not_sold") {
    setError(null);
    try {
      onTally(await api.post<Tally>(`/rounds/${round.roundId}/votes`, { voterId: getVoterId(), vote: v }));
      setVoted(v);
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_voted") {
        setVoted("already");
        onTally({ votesSold: Number(e.details.votesSold ?? tally.votesSold), votesNotSold: Number(e.details.votesNotSold ?? tally.votesNotSold) });
      } else setError(e instanceof ApiError ? e.message : "Vote not counted. Try again.");
    }
  }

  return (
    <Box component="section" aria-label="Votes" sx={{ ...panel, p: 2, display: "grid", gap: 1.5 }}>
      <Typography sx={{ fontWeight: 800 }}>Did the seller close?</Typography>
      {open && !voted && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="contained" onClick={() => vote("sold")} sx={{ flex: 1 }}>Sold</Button>
          <Button variant="outlined" onClick={() => vote("not_sold")} sx={{ flex: 1 }}>Not sold</Button>
        </Box>
      )}
      {!open && <Typography variant="body2" sx={{ color: hall.muted }}>Voting opens at the buzzer.</Typography>}
      {voted && <Typography variant="body2" sx={{ color: hall.greenDeep, fontWeight: 700 }}>{voted === "already" ? "You already voted on this round." : "Vote counted. Thanks!"}</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      <Box aria-label={`${tally.votesSold} sold, ${tally.votesNotSold} not sold`} sx={{ display: "grid", gap: 0.5 }}>
        <Box sx={{ height: 10, borderRadius: 999, bgcolor: hall.chip, overflow: "hidden" }}>
          <Box sx={{ height: "100%", width: "100%", bgcolor: hall.green, transformOrigin: "left", transform: `scaleX(${pct / 100})`, transition: "transform 300ms" }} />
        </Box>
        <Typography variant="body2" sx={{ color: hall.muted }}>
          Sold {tally.votesSold} · Not sold {tally.votesNotSold}
        </Typography>
      </Box>
    </Box>
  );
}

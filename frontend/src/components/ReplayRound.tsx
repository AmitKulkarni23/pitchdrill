"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { Comments } from "@/components/Comments";
import { ReplayPlayer } from "@/components/ReplayPlayer";
import { ReportDialog } from "@/components/ReportDialog";
import { VotePanel } from "@/components/VotePanel";
import { studio } from "@/config/tokens";
import { useTimeZone } from "@/hooks/useClock";
import { useNow } from "@/hooks/useClock";
import { usePolling } from "@/hooks/usePolling";
import { api, ApiError } from "@/lib/api";
import { replayState } from "@/lib/replay";
import { slotWhen } from "@/lib/slots";
import { tallyReducer, type Tally } from "@/lib/votes";
import type { PublicRound } from "@/types/api";

/** Replay page: recording, votes (still open), comments and a report button. */
export function ReplayRound({ roundId }: { roundId: string }) {
  const timeZone = useTimeZone();
  const now = useNow();
  const [round, setRound] = useState<PublicRound | null>();
  const [tally, setTally] = useState<Tally>({ sold: 0, notSold: 0 });
  const [reporting, setReporting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ round: PublicRound }>(`/rounds/${roundId}`);
      setRound(res.round);
      setTally((t) => tallyReducer(t, { sold: res.round.votesSold, notSold: res.round.votesNotSold }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "round_not_found") setRound(null);
    }
  }, [roundId]);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const state = round === undefined ? undefined : replayState(round);
  // The recording takes a little while after the round ends; keep checking until it is there.
  usePolling(refresh, state === "processing" ? 30_000 : null);

  if (state === undefined) return <Typography sx={{ color: studio.haze }}>Loading…</Typography>;
  if (state === "unavailable" || !round) return <Typography variant="h2">This replay isn&apos;t available</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 4 }}>
      <Box>
        <Typography variant="h2">@{round.sellerHandle} vs @{round.buyerHandle}</Typography>
        {timeZone && now !== null && <Typography sx={{ color: studio.haze }}>{slotWhen(round.slotId, now, timeZone)}</Typography>}
      </Box>
      {state === "cancelled" && <Alert severity="warning">This round was cancelled.</Alert>}
      {state === "processing" && <Alert severity="info">Replay is processing. This page checks again every 30 seconds.</Alert>}
      {state === "playing" && round.replayUrl && <ReplayPlayer src={round.replayUrl} />}
      {state !== "cancelled" && (
        <>
          <Box sx={{ display: "grid", gap: 2 }}>
            <Typography variant="h3">Did they sell it?</Typography>
            <VotePanel roundId={roundId} tally={tally} onTally={(t) => setTally((prev) => tallyReducer(prev, t))} />
          </Box>
          <Comments roundId={roundId} />
        </>
      )}
      <Box>
        <Button variant="text" color="inherit" onClick={() => setReporting(true)}>Report this round</Button>
      </Box>
      <ReportDialog roundId={roundId} open={reporting} onClose={() => setReporting(false)} />
    </Box>
  );
}

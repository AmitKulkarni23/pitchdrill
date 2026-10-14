"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { ChatPanel } from "@/components/ChatPanel";
import { VotePanel } from "@/components/VotePanel";
import { RoundTimer } from "@/components/arena/RoundTimer";
import { SplitScreen, type Tile } from "@/components/arena/SplitScreen";
import { studio } from "@/config/tokens";
import { useNow } from "@/hooks/useClock";
import { usePolling } from "@/hooks/usePolling";
import { useStage } from "@/hooks/useStage";
import { api, ApiError } from "@/lib/api";
import { arenaPhase, type RoundEvent } from "@/lib/arena";
import { getVoterId } from "@/lib/storage";
import { tallyReducer, type Tally } from "@/lib/votes";
import type { PublicRound, Role } from "@/types/api";

/** Spectator page: subscribe-only video, chat, timer, then voting at the buzzer. */
export function WatchRound({ roundId }: { roundId: string }) {
  const now = useNow();
  const [round, setRound] = useState<PublicRound>();
  const [missing, setMissing] = useState(false);
  const [stageToken, setStageToken] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>();
  const [buzzed, setBuzzed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [tally, setTally] = useState<Tally>({ sold: 0, notSold: 0 });

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ round: PublicRound }>(`/rounds/${roundId}`);
      setRound(res.round);
      if (res.round.startedAt) setStartedAt(Date.parse(res.round.startedAt));
      setTally((t) => tallyReducer(t, { sold: res.round.votesSold, notSold: res.round.votesNotSold }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "round_not_found") setMissing(true);
    }
  }, [roundId]);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const phaseNow = round && now !== null ? arenaPhase({ now, slotStart: Date.parse(round.slotId), startedAt, status: cancelled ? "cancelled" : round.status, buzzed }) : null;
  const phase = phaseNow?.phase;
  const finished = phase === "buzzer" || phase === "ended" || phase === "cancelled";
  usePolling(refresh, phase === "ended" || phase === "cancelled" ? null : 5000);

  // Subscribe-only stage token while the stage exists.
  const joinable = round && (round.status === "ready" || round.status === "live") && !finished;
  useEffect(() => {
    if (!joinable || stageToken) return;
    let cancelledReq = false;
    api
      .post<{ stageToken: string }>(`/rounds/${roundId}/watch`, { voterId: getVoterId() })
      .then((r) => !cancelledReq && setStageToken(r.stageToken))
      .catch(() => {});
    return () => {
      cancelledReq = true;
    };
  }, [joinable, stageToken, roundId]);
  const { tiles, error: stageError } = useStage(finished ? null : stageToken);

  const onEvent = useCallback((e: RoundEvent) => {
    if (e.kind === "round_started") setStartedAt(e.startedAt);
    else if (e.kind === "buzzer") setBuzzed(true);
    else if (e.kind === "round_cancelled") setCancelled(true);
    else setTally((t) => tallyReducer(t, { sold: e.sold, notSold: e.notSold }));
  }, []);

  if (missing) return <Typography variant="h2">That round doesn&apos;t exist</Typography>;
  if (!round) return <Typography sx={{ color: studio.haze }}>Loading…</Typography>;

  const splitTiles: Tile[] = tiles
    .filter((t) => t.attributes.role === "seller" || t.attributes.role === "buyer")
    .map((t) => ({ role: t.attributes.role as Role, handle: t.attributes.handle ?? "", stream: t.stream }));
  const noVideoLeft = phase === "ended" || (phase === "buzzer" && !stageToken);
  const canVote = phase === "buzzer" || phase === "ended";

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Typography variant="h2">
        @{round.sellerHandle} vs @{round.buyerHandle}
      </Typography>
      {phase === "cancelled" ? (
        <Alert severity="warning">This round was cancelled.</Alert>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(0, 1fr)" }, gap: 3, alignItems: "start" }}>
          <Box sx={{ display: "grid", gap: 2 }}>
            {stageError && <Alert severity="error">{stageError}</Alert>}
            {noVideoLeft ? (
              <Typography sx={{ color: studio.haze }}>This round is over. Watch the replay once it&apos;s ready.</Typography>
            ) : (
              <SplitScreen tiles={splitTiles.length ? splitTiles : [{ role: "seller", handle: round.sellerHandle, stream: null }, { role: "buyer", handle: round.buyerHandle, stream: null }]} />
            )}
            {phaseNow && phase !== "ended" && <RoundTimer result={phaseNow} />}
          </Box>
          <ChatPanel roundId={roundId} onEvent={onEvent} />
        </Box>
      )}
      {canVote && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Typography variant="h3">Did they sell it?</Typography>
          <VotePanel roundId={roundId} tally={tally} onTally={(t) => setTally((prev) => tallyReducer(prev, t))} />
          <Button variant="outlined" href={`/r/${roundId}`} sx={{ justifySelf: "start" }}>
            Replay page
          </Button>
        </Box>
      )}
    </Box>
  );
}

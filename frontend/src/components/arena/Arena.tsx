"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import { useRoundEvents, type ChatTokenValue } from "@/hooks/useRoundEvents";
import { useNow } from "@/hooks/useClock";
import { usePolling } from "@/hooks/usePolling";
import { useStage } from "@/hooks/useStage";
import { api } from "@/lib/api";
import { arenaPhase, type RoundEvent } from "@/lib/arena";
import type { Booking, PublicRound, Role } from "@/types/api";
import { BriefPanel } from "./BriefPanel";
import { DeviceCheck } from "./DeviceCheck";
import { RoundTimer } from "./RoundTimer";
import { SplitScreen, type Tile } from "./SplitScreen";

interface Props {
  ticket: string;
  booking: Booking;
  round: PublicRound;
}

/** Participant arena: device check, stage, brief, timer, buzzer and the result. */
export function Arena({ ticket, booking, round: initial }: Props) {
  const now = useNow();
  const [round, setRound] = useState(initial);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [tokens, setTokens] = useState<{ stageToken: string; chatToken: ChatTokenValue } | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | undefined>(initial.startedAt ? Date.parse(initial.startedAt) : undefined);
  const [buzzed, setBuzzed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [tally, setTally] = useState({ sold: initial.votesSold, notSold: initial.votesNotSold });

  const slotStart = Date.parse(round.slotId);
  const status = cancelled ? "cancelled" : round.status;
  const result = now === null ? null : arenaPhase({ now, slotStart, startedAt, status, buzzed });
  const phase = result?.phase;
  const finished = phase === "buzzer" || phase === "ended" || phase === "cancelled";

  // Leave the stage and release devices once the round is over.
  const stageToken = finished ? null : (tokens?.stageToken ?? null);
  const { tiles, state: stageState, error: stageError } = useStage(stageToken, finished ? null : localStream);
  useEffect(() => {
    if (finished) localStream?.getTracks().forEach((t) => t.stop());
  }, [finished, localStream]);
  useEffect(() => () => localStream?.getTracks().forEach((t) => t.stop()), [localStream]);

  const onEvent = useCallback((e: RoundEvent) => {
    if (e.kind === "round_started") setStartedAt(e.startedAt);
    else if (e.kind === "buzzer") setBuzzed(true);
    else if (e.kind === "round_cancelled") setCancelled(true);
    else setTally({ sold: e.sold, notSold: e.notSold });
  }, []);
  useRoundEvents(finished ? null : (tokens?.chatToken ?? null), onEvent);

  // Fallback for missed chat events.
  const refreshRound = useCallback(async () => {
    try {
      const { round } = await api.get<{ round: PublicRound }>(`/rounds/${initial.roundId}`);
      setRound(round);
      if (round.startedAt) setStartedAt(Date.parse(round.startedAt));
      setTally({ sold: round.votesSold, notSold: round.votesNotSold });
    } catch {
      // The next poll tries again.
    }
  }, [initial.roundId]);
  usePolling(refreshRound, phase === "ended" || phase === "cancelled" ? null : 5000);

  async function join(stream: MediaStream) {
    setJoining(true);
    setError(null);
    try {
      setTokens(await api.post(`/rounds/${round.roundId}/join`, {}, { ticket }));
      setLocalStream(stream);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      setError(e instanceof Error ? e.message : "Couldn't join the stage.");
      setJoining(false);
    }
  }

  const role: Role = booking.role;
  const remote = tiles.find((t) => t.attributes.role && t.attributes.role !== role);
  const splitTiles: Tile[] = [];
  if (localStream) splitTiles.push({ role, handle: booking.handle, stream: localStream, muted: true });
  if (remote) splitTiles.push({ role: remote.attributes.role as Role, handle: remote.attributes.handle ?? "opponent", stream: remote.stream });

  if (!tokens)
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {finished && phase !== "cancelled" ? (
          <Result round={round} tally={tally} />
        ) : phase === "cancelled" ? (
          <Alert severity="warning">Your opponent didn&apos;t show.</Alert>
        ) : (
          <DeviceCheck onJoin={join} joining={joining} />
        )}
      </Box>
    );

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {(error || stageError) && <Alert severity="error">{error ?? stageError}</Alert>}
      {stageState === "connecting" && !finished && <Typography sx={{ color: studio.haze }}>Connecting to the stage…</Typography>}
      <SplitScreen tiles={splitTiles} />
      {result && <RoundTimer result={result} />}
      {phase === "cancelled" && <Alert severity="warning">Your opponent didn&apos;t show.</Alert>}
      {phase !== "cancelled" && !finished && (
        <BriefPanel ticket={ticket} roundId={round.roundId} unlocked={phase !== "pre-brief"} unlocksInMs={phase === "pre-brief" ? result?.untilMs : undefined} />
      )}
      {(phase === "buzzer" || phase === "ended") && <Result round={round} tally={tally} />}
    </Box>
  );
}

function Result({ round, tally }: { round: PublicRound; tally: { sold: number; notSold: number } }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5, justifyItems: "start" }}>
      <Typography sx={{ ...strapType, fontSize: "1.5rem" }}>The audience says</Typography>
      <Box sx={{ display: "flex", gap: 3, ...strapType, fontSize: "2.5rem" }} aria-live="polite">
        <Box component="span" sx={{ color: studio.signal }}>Sold {tally.sold}</Box>
        <Box component="span" sx={{ color: studio.haze }}>Not sold {tally.notSold}</Box>
      </Box>
      <Button variant="contained" href={`/r/${round.roundId}`}>
        Open the replay page
      </Button>
    </Box>
  );
}

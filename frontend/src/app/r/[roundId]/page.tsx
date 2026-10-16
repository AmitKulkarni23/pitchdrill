"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Box, Typography } from "@mui/material";
import { ChatPanel, type RoundEvent } from "@/components/round/ChatPanel";
import { CommentsPanel } from "@/components/round/CommentsPanel";
import { ReplayVideo } from "@/components/round/ReplayVideo";
import { RoundClock, RoundShell } from "@/components/round/RoundShell";
import { StageVideo } from "@/components/round/StageVideo";
import { VotePanel } from "@/components/round/VotePanel";
import { hall, panel } from "@/config/tokens";
import { useNow } from "@/hooks/useClock";
import { useRound } from "@/hooks/useRound";
import { api, ApiError } from "@/lib/api";
import { getVoterId } from "@/lib/storage";

/** Spectator page: live split screen + chat while the round runs, then votes, replay and comments. */
// useParams needs a Suspense boundary with cacheComponents; the page itself is all client-side.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <WatchPage />
    </Suspense>
  );
}

function WatchPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const { round, setRound, error, refresh } = useRound(roundId);
  const now = useNow();
  const [token, setToken] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const liveish = round?.status === "ready" || round?.status === "live";

  useEffect(() => {
    if (!liveish || token) return;
    api
      .post<{ stageToken: string }>(`/rounds/${roundId}/watch`, { voterId: getVoterId() })
      .then((r) => setToken(r.stageToken))
      .catch((e) => setWatchError(e instanceof ApiError ? e.message : "Couldn't load the live video."));
  }, [liveish, token, roundId]);

  function onEvent(e: RoundEvent) {
    if (e.name === "tally") setRound((r) => r && { ...r, votesSold: Number(e.attributes.sold), votesNotSold: Number(e.attributes.notSold) });
    else refresh();
  }

  if (error) return <RoundShell title="Round not found"><Alert severity="error">{error.message}</Alert></RoundShell>;
  if (!round || now === null) return <RoundShell title="Loading round…"><Box sx={{ ...panel, height: 360 }} /></RoundShell>;

  const title = round.product ? round.product.name : `@${round.sellerHandle} vs @${round.buyerHandle}`;
  return (
    <RoundShell title={title} subtitle={`Seller @${round.sellerHandle} · Buyer @${round.buyerHandle}${round.product ? ` · ${round.product.price}` : ""}`}>
      <RoundClock round={round} now={now} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2.5, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 2.5 }}>
          {liveish && (token ? <StageVideo token={token} publish={false} sellerHandle={round.sellerHandle} buyerHandle={round.buyerHandle} /> : watchError && <Alert severity="error">{watchError}</Alert>)}
          {(round.status === "ended" || round.status === "closed") &&
            (round.replayUrl ? (
              <ReplayVideo src={round.replayUrl} />
            ) : (
              <Box sx={{ ...panel, p: 3, color: hall.muted }}>The replay is processing and will appear here in a few minutes.</Box>
            ))}
          {round.status === "cancelled" && <Alert severity="info">This round was cancelled.</Alert>}
          {round.product && (
            <Typography sx={{ color: hall.muted }}>{round.product.tagline}</Typography>
          )}
          {(round.status === "ended" || round.status === "closed") && <CommentsPanel roundId={round.roundId} open />}
        </Box>
        <Box sx={{ display: "grid", gap: 2.5 }}>
          <VotePanel round={round} tally={round} onTally={(t) => setRound((r) => r && { ...r, ...t })} />
          {(liveish || round.status === "ended") && <ChatPanel roundId={round.roundId} onEvent={onEvent} />}
        </Box>
      </Box>
    </RoundShell>
  );
}

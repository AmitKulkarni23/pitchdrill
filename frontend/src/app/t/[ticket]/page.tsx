"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Box, Button, Typography } from "@mui/material";
import { ChatPanel, type RoundEvent } from "@/components/round/ChatPanel";
import { RoundClock, RoundShell } from "@/components/round/RoundShell";
import { StageVideo } from "@/components/round/StageVideo";
import { hall, panel } from "@/config/tokens";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { useRound } from "@/hooks/useRound";
import { api, ApiError } from "@/lib/api";
import { countdown, slotLabel } from "@/lib/slots";
import { addTicket } from "@/lib/storage";
import type { Booking, BriefResponse, JoinResponse } from "@/types/api";

const OPEN_BEFORE = 5 * 60_000;

/** Ticket page and participant arena: booking status, then camera + brief + timer for the round. */
// useParams needs a Suspense boundary with cacheComponents; the page itself is all client-side.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TicketPage />
    </Suspense>
  );
}

function TicketPage() {
  const { ticket } = useParams<{ ticket: string }>();
  const now = useNow();
  const timeZone = useTimeZone();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [join, setJoin] = useState<JoinResponse | null>(null);
  const [camera, setCamera] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const { round, refresh } = useRound(booking?.roundId);

  const loadBooking = useCallback(async () => {
    try {
      setBooking((await api.get<{ booking: Booking }>("/ticket", { ticket })).booking);
      addTicket(ticket);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your ticket.");
    }
  }, [ticket]);

  // Until paired, re-check the booking every 10 s so a new opponent shows up.
  useEffect(() => {
    const first = setTimeout(loadBooking, 0);
    if (booking?.roundId || booking?.status === "no_opponent") return () => clearTimeout(first);
    const id = setInterval(loadBooking, 10_000);
    return () => (clearTimeout(first), clearInterval(id));
  }, [loadBooking, booking?.roundId, booking?.status]);

  // Brief unlocks at T-30s; poll until it arrives.
  const start = booking ? Date.parse(booking.slotId) : 0;
  const briefDue = now !== null && booking?.roundId && now >= start - 30_000;
  useEffect(() => {
    if (!briefDue || brief) return;
    const get = () => api.get<BriefResponse>(`/rounds/${booking!.roundId}/brief`, { ticket }).then(setBrief).catch(() => {});
    get();
    const id = setInterval(get, 3000);
    return () => clearInterval(id);
  }, [briefDue, brief, booking, ticket]);

  async function joinRound(withCamera: boolean) {
    setJoinError(null);
    setCamera(withCamera);
    try {
      setJoin(await api.post<JoinResponse>(`/rounds/${booking!.roundId}/join`, {}, { ticket }));
    } catch (e) {
      setJoinError(e instanceof ApiError ? e.message : "Couldn't join. Try again.");
    }
  }

  const onEvent = (e: RoundEvent) => e.name !== "tally" && refresh();

  if (error) return <RoundShell title="Ticket not found"><Alert severity="error">{error}</Alert></RoundShell>;
  if (!booking || now === null || timeZone === null) return <RoundShell title="Loading your ticket…"><Box sx={{ ...panel, height: 240 }} /></RoundShell>;

  const other = booking.role === "seller" ? "buyer" : "seller";
  const subtitle = `@${booking.handle} as ${booking.role} · ${slotLabel(booking.slotId, now, timeZone)}${booking.opponentHandle ? ` · vs @${booking.opponentHandle}` : ""}`;

  if (!booking.roundId)
    return (
      <RoundShell title={booking.status === "no_opponent" ? "No opponent this time" : `Waiting for a ${other}`} subtitle={subtitle}>
        <Box sx={{ ...panel, p: 3, display: "grid", gap: 1 }}>
          {booking.status === "no_opponent" ? (
            <Typography>Nobody booked the {other} seat for this slot. Book another slot from the home page.</Typography>
          ) : (
            <>
              <Typography>You&apos;ll be paired as soon as a {other} books this slot. This page updates on its own.</Typography>
              <Typography sx={{ color: hall.muted }}>Slot starts in {countdown(start - now)}.</Typography>
            </>
          )}
          <Button href="/" variant="outlined" sx={{ justifySelf: "start" }}>Home</Button>
        </Box>
      </RoundShell>
    );

  if (!round) return <RoundShell title="Loading your round…" subtitle={subtitle}><Box sx={{ ...panel, height: 240 }} /></RoundShell>;

  const arenaOpen = round.status === "ready" || round.status === "live";
  const finished = round.status === "ended" || round.status === "closed";
  return (
    <RoundShell title={finished ? "Round over" : round.status === "cancelled" ? "Round cancelled" : "Your round"} subtitle={subtitle}>
      <RoundClock round={round} now={now} />
      {round.status === "paired" && (
        <Box sx={{ ...panel, p: 3 }}>
          <Typography>The arena opens 5 minutes before the start ({countdown(start - OPEN_BEFORE - now)} from now). Keep this page open; it updates on its own.</Typography>
        </Box>
      )}
      {round.status === "cancelled" && <Alert severity="info">{round.cancelReason === "no_show" ? "Both players have to join when the round starts. Book another slot to try again." : "A moderator ended this round."}</Alert>}
      {finished && (
        <Box sx={{ ...panel, p: 3, display: "grid", gap: 1 }}>
          <Typography>Time&apos;s up. See how the audience voted and watch the replay.</Typography>
          <Button href={`/r/${round.roundId}`} variant="contained" sx={{ justifySelf: "start" }}>Votes and replay</Button>
        </Box>
      )}
      {arenaOpen && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2.5, alignItems: "start" }}>
          <Box sx={{ display: "grid", gap: 2 }}>
            {join ? (
              <StageVideo token={join.stageToken} publish camera={camera} sellerHandle={round.sellerHandle} buyerHandle={round.buyerHandle} />
            ) : (
              <Box sx={{ ...panel, p: 3, display: "grid", gap: 1.5 }}>
                <Typography>Join now, on camera or mic only. The round starts when both of you are in at the start time; if someone is missing a minute after, it&apos;s cancelled.</Typography>
                {joinError && <Alert severity="error">{joinError}</Alert>}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                  <Button variant="contained" size="large" onClick={() => joinRound(true)}>Join with camera</Button>
                  <Button variant="outlined" size="large" onClick={() => joinRound(false)}>Join with mic only</Button>
                </Box>
              </Box>
            )}
          </Box>
          <Box sx={{ display: "grid", gap: 2.5 }}>
            <Box component="section" aria-label="Your brief" sx={{ ...panel, p: 2, display: "grid", gap: 1 }}>
              <Typography sx={{ fontWeight: 800 }}>{booking.role === "seller" ? "Your product" : "Your secret persona"}</Typography>
              {brief ? (
                <>
                  <Typography sx={{ fontWeight: 700 }}>{brief.product.name} · {brief.product.price}</Typography>
                  <Typography variant="body2" sx={{ color: hall.muted }}>{brief.product.tagline}</Typography>
                  <Typography variant="body2" data-testid="brief" sx={{ whiteSpace: "pre-wrap" }}>{brief.brief}</Typography>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: hall.muted }}>Unlocks 30 seconds before the start{now < start - 30_000 ? ` (in ${countdown(start - 30_000 - now)})` : "…"}.</Typography>
              )}
            </Box>
            {join && <ChatPanel roundId={round.roundId} participantToken={join.chatToken} onEvent={onEvent} />}
          </Box>
        </Box>
      )}
    </RoundShell>
  );
}

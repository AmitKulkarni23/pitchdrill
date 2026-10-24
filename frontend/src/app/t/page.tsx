"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { ChatPanel, type RoundEvent } from "@/components/round/ChatPanel";
import { BriefList, RoundClock, RoundShell } from "@/components/round/RoundShell";
import { StageVideo } from "@/components/round/StageVideo";
import { hall, panel } from "@/config/tokens";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { useRound } from "@/hooks/useRound";
import { api, ApiError } from "@/lib/api";
import { countdown, slotLabel, timeLabel } from "@/lib/slots";
import { addPlayedRound, addTicket } from "@/lib/storage";
import type { Booking, BriefResponse, JoinResponse } from "@/types/api";

const BRIEF_BEFORE = 5 * 60_000;
// The stage opens on the tick at T-2m (~24 s past the minute, so ready by ~T-1:36); the button follows the clock, not the tick.
const JOIN_BEFORE = 60_000;

/** Ticket page and participant arena: booking status, then mic + brief + timer for the round. */
// The ticket lives in the URL fragment (/t#<ticket>): browsers never send it to servers, so it stays out of request logs,
// Referer headers and analytics. Old /t/<ticket> links are redirected here by proxy.ts.
const onHashChange = (cb: () => void) => (window.addEventListener("hashchange", cb), () => window.removeEventListener("hashchange", cb));

export default function Page() {
  const ticket = useSyncExternalStore(onHashChange, () => decodeURIComponent(window.location.hash.slice(1)), () => null);
  if (ticket === null) return null;
  if (!ticket) return <RoundShell title="Ticket not found"><Alert severity="error">This link is missing its ticket.</Alert></RoundShell>;
  return <TicketPage key={ticket} ticket={ticket} />;
}

function TicketPage({ ticket }: { ticket: string }) {
  const now = useNow();
  const timeZone = useTimeZone();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [join, setJoin] = useState<JoinResponse | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const { round, refresh } = useRound(booking?.roundId);

  const loadBooking = useCallback(async () => {
    try {
      const { booking } = await api.get<{ booking: Booking }>("/ticket", { ticket });
      setBooking(booking);
      addTicket(ticket);
      if (booking.roundId) addPlayedRound(booking.roundId);
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

  // Brief unlocks at T-5m; poll until it arrives.
  const start = booking ? Date.parse(booking.slotId) : 0;
  const briefDue = now !== null && booking?.roundId && now >= start - BRIEF_BEFORE;
  useEffect(() => {
    if (!briefDue || brief) return;
    const get = () => api.get<BriefResponse>(`/rounds/${booking!.roundId}/brief`, { ticket }).then(setBrief).catch(() => {});
    get();
    const id = setInterval(get, 3000);
    return () => clearInterval(id);
  }, [briefDue, brief, booking, ticket]);

  async function joinRound() {
    setJoinError(null);
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
  const joinOpen = arenaOpen && now >= start - JOIN_BEFORE;
  const briefOpen = arenaOpen || (round.status === "paired" && now >= start - BRIEF_BEFORE);
  const finished = round.status === "ended" || round.status === "closed";
  return (
    <RoundShell title={finished ? "Round over" : round.status === "cancelled" ? "Round cancelled" : "Your round"} subtitle={subtitle}>
      <RoundClock round={round} now={now} />
      {round.status === "paired" && !briefOpen && (
        <Box sx={{ ...panel, p: 3 }}>
          <Typography>Your brief appears here 5 minutes before the start (in {countdown(start - BRIEF_BEFORE - now)}), and you can join the round 1 minute before. Keep this page open; it updates on its own.</Typography>
        </Box>
      )}
      {round.status === "cancelled" && <Alert severity="info">{round.cancelReason === "no_show" ? "Both players have to join when the round starts. Book another slot to try again." : "A moderator ended this round."}</Alert>}
      {finished && (
        <Box sx={{ ...panel, p: 3, display: "grid", gap: 1 }}>
          <Typography>Time&apos;s up. See how the audience voted and watch the replay.</Typography>
          <Button href={`/r/${round.roundId}`} variant="contained" sx={{ justifySelf: "start" }}>Votes and replay</Button>
        </Box>
      )}
      {briefOpen && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2.5, alignItems: "start" }}>
          <Box sx={{ display: "grid", gap: 2 }}>
            {!joinOpen ? (
              <Box sx={{ ...panel, p: 3, display: "grid", gap: 1.5 }}>
                <Typography>Read your brief while you wait. Joining opens 1 minute before the start.</Typography>
                <Button variant="contained" size="large" disabled sx={{ justifySelf: "start" }}>
                  Join with mic in {countdown(Math.max(0, start - JOIN_BEFORE - now))}
                </Button>
              </Box>
            ) : join ? (
              <StageVideo token={join.stageToken} publish camera={false} live={round.status === "live" && now < Date.parse(round.endsAt!)} sellerHandle={round.sellerHandle} buyerHandle={round.buyerHandle} />
            ) : (
              <Box sx={{ ...panel, p: 3, display: "grid", gap: 1.5 }}>
                <Typography>Join now so you&apos;re ready. The round is audio only and starts at {timeLabel(round.slotId, timeZone)} once you&apos;re both in. If either of you hasn&apos;t joined by {timeLabel(new Date(start + 60_000).toISOString(), timeZone)}, it&apos;s cancelled. <strong>Rounds are recorded and replayed publicly.</strong></Typography>
                {joinError && <Alert severity="error">{joinError}</Alert>}
                <Button variant="contained" size="large" onClick={joinRound} sx={{ justifySelf: "start" }}>Join with mic</Button>
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
                  <Box data-testid="brief"><BriefList points={brief.brief} /></Box>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: hall.muted }}>Your brief is on its way…</Typography>
              )}
            </Box>
            {join && <ChatPanel roundId={round.roundId} participantToken={join.chatToken} onEvent={onEvent} />}
          </Box>
        </Box>
      )}
    </RoundShell>
  );
}

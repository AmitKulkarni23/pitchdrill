"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Skeleton, Typography } from "@mui/material";
import { Strap } from "@/components/broadcast/Strap";
import { Arena } from "@/components/arena/Arena";
import { studio, strapType } from "@/config/tokens";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { usePolling } from "@/hooks/usePolling";
import { api, ApiError } from "@/lib/api";
import { slotWhen } from "@/lib/slots";
import { addTicket } from "@/lib/storage";
import { formatCountdown } from "@/lib/time";
import { pollInterval, ticketView } from "@/lib/ticketView";
import type { Booking, PublicRound } from "@/types/api";

type Load = { state: "loading" } | { state: "invalid" } | { state: "error"; message: string } | { state: "ok" };

/** The page a booker returns to: who they are, when, against whom, and what to do next. */
export function TicketStatus({ ticket }: { ticket: string }) {
  const now = useNow();
  const timeZone = useTimeZone();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [booking, setBooking] = useState<Booking>();
  const [round, setRound] = useState<PublicRound>();
  const [inArena, setInArena] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { booking } = await api.get<{ booking: Booking }>("/ticket", { ticket });
      addTicket(ticket);
      setBooking(booking);
      if (booking.roundId) {
        const { round } = await api.get<{ round: PublicRound }>(`/rounds/${booking.roundId}`);
        setRound(round);
      }
      setLoad({ state: "ok" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "bad_ticket") setLoad({ state: "invalid" });
      // A failed refresh keeps showing what we already have.
      else setLoad((prev) => (prev.state === "ok" ? prev : { state: "error", message: e instanceof Error ? e.message : "Something went wrong." }));
    }
  }, [ticket]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(refresh, booking ? pollInterval(booking, round) : null);

  if (load.state === "loading") return <Skeleton variant="rectangular" height={220} sx={{ bgcolor: studio.cobaltDeep }} />;
  if (load.state === "invalid")
    return (
      <Box sx={{ display: "grid", gap: 2, justifyItems: "start" }}>
        <Typography variant="h2">This ticket link isn&apos;t valid</Typography>
        <Typography sx={{ color: studio.haze }}>Check the link you saved, or book a new seat.</Typography>
        <Button variant="contained" href="/">Back home</Button>
      </Box>
    );
  if (load.state === "error" || !booking)
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={() => void refresh()}>Retry</Button>}>
        {load.state === "error" ? load.message : "Something went wrong."}
      </Alert>
    );

  const view = ticketView(booking, round);
  const start = Date.parse(booking.slotId);
  const otherSide = booking.role === "seller" ? "buyer" : "seller";

  if (inArena && round && view.kind === "enter_arena") return <Arena ticket={ticket} booking={booking} round={round} />;

  return (
    <Box sx={{ display: "grid", gap: 3, justifyItems: "start" }}>
      <Strap tab={booking.role} tone={booking.role} title={`@${booking.handle}`} sub={timeZone && now !== null ? slotWhen(booking.slotId, now, timeZone) : undefined} />

      {now !== null && now < start && (
        <Box aria-live="off">
          <Typography sx={{ ...strapType, fontSize: "0.875rem", letterSpacing: "0.12em", color: studio.haze }}>On air in</Typography>
          <Typography sx={{ ...strapType, fontSize: { xs: "3.5rem", sm: "5rem" }, color: studio.signal }}>{formatCountdown(start - now)}</Typography>
        </Box>
      )}

      <Typography sx={{ fontSize: "1.25rem" }}>
        {booking.opponentHandle ? `vs @${booking.opponentHandle}` : view.kind === "no_opponent" ? "" : `Waiting for a ${otherSide}…`}
      </Typography>

      {view.kind === "no_opponent" && (
        <>
          <Typography>No opponent booked this slot.</Typography>
          <Button variant="contained" href="/#guide">Book another slot</Button>
        </>
      )}
      {view.kind === "waiting" && <Typography sx={{ color: studio.haze }}>We&apos;ll pair you as soon as a {otherSide} books this slot. Keep this page open or come back with your link.</Typography>}
      {(view.kind === "opens_soon" || view.kind === "loading_round") && <Typography sx={{ color: studio.haze }}>The arena opens 5 minutes before your round.</Typography>}
      {view.kind === "enter_arena" && (
        <Button variant="contained" size="large" onClick={() => setInArena(true)} sx={{ fontSize: "1.25rem", px: 4 }}>
          Enter the arena
        </Button>
      )}
      {view.kind === "cancelled" && <Alert severity="warning">{view.message}</Alert>}
      {view.kind === "replay" && (
        <Button variant="contained" href={`/r/${view.roundId}`}>
          Watch the replay
        </Button>
      )}
    </Box>
  );
}

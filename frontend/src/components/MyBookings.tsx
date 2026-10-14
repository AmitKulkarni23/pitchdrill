"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { Strap } from "@/components/broadcast/Strap";
import { studio } from "@/config/tokens";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { api } from "@/lib/api";
import { slotWhen } from "@/lib/slots";
import { getTickets } from "@/lib/storage";
import type { Booking } from "@/types/api";

/** Bookings saved in this browser, upcoming first. Renders nothing when there are none. */
export function MyBookings() {
  const now = useNow();
  const timeZone = useTimeZone();
  const [items, setItems] = useState<{ ticket: string; booking: Booking }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      getTickets().map((ticket) =>
        api.get<{ booking: Booking }>("/ticket", { ticket }).then(
          ({ booking }) => ({ ticket, booking }),
          () => null, // invalid or unreachable tickets are skipped
        ),
      ),
    ).then((all) => {
      if (cancelled) return;
      const found = all.filter((x): x is { ticket: string; booking: Booking } => x !== null);
      setItems(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items.length || !timeZone || now === null) return null;
  const upcomingFirst = [...items].sort((a, b) => {
    const au = Date.parse(a.booking.slotId) >= now - 30 * 60_000;
    const bu = Date.parse(b.booking.slotId) >= now - 30 * 60_000;
    return au === bu ? Date.parse(a.booking.slotId) - Date.parse(b.booking.slotId) : au ? -1 : 1;
  });

  return (
    <Box component="section" aria-labelledby="mine-title" sx={{ px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto", pt: { xs: 5, md: 7 } }}>
      <Typography id="mine-title" variant="h2" sx={{ mb: 2 }}>
        My bookings
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.5 }}>
        {upcomingFirst.map(({ ticket, booking }) => (
          <Box component="li" key={ticket}>
            <Box component="a" href={`/t/${ticket}`} sx={{ color: "inherit", textDecoration: "none", display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Strap size="sm" tab={booking.role} tone={booking.role} title={`@${booking.handle}`} sub={slotWhen(booking.slotId, now, timeZone)} />
              <Typography sx={{ color: studio.haze }}>
                {booking.opponentHandle ? `vs @${booking.opponentHandle}` : booking.status === "no_opponent" ? "No opponent" : "Waiting for an opponent…"}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

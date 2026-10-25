"use client";

import { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { slotLabel } from "@/lib/slots";
import { getTickets, removeTicket } from "@/lib/storage";
import { hall } from "@/config/tokens";
import type { Booking } from "@/types/api";

/** A round's page stays useful until T+20m (briefs, arena, buzzer); after that it's history. */
const OPEN_AFTER = 20 * 60_000;

type Entry = { ticket: string; booking: Booking };

const status = (b: Booking) =>
  b.status === "no_opponent"
    ? "No opponent found"
    : b.opponentHandle
      ? `vs @${b.opponentHandle}`
      : `Waiting for a ${b.role === "seller" ? "buyer" : "seller"}`;

/** Rounds booked from this browser, so coming back on the same device needs no link. Renders nothing when there are none. */
export function YourRounds({ now, timeZone, refreshKey }: { now: number; timeZone: string; refreshKey?: string }) {
  const [seats, setEntries] = useState<Entry[]>([]);

  // Reloads on a new booking here (refreshKey), a booking in another tab (storage event), and every 30 s so
  // "Waiting for a buyer" turns into "vs @opponent" once someone books the other side.
  useEffect(() => {
    const load = () => {
      const at = Date.now();
      Promise.all(
        getTickets().map((ticket) =>
          api.get<{ booking: Booking }>("/ticket", { ticket }).then(
            ({ booking }) => {
              if (Date.parse(booking.slotId) + OPEN_AFTER > at) return { ticket, booking };
              removeTicket(ticket);
            },
            (e) => void (e instanceof ApiError && e.code === "bad_ticket" && removeTicket(ticket)), // keep it on network errors
          ),
        ),
      ).then((list) => setEntries(list.filter((s): s is Entry => !!s).sort((a, b) => a.booking.slotId.localeCompare(b.booking.slotId))));
    };
    load();
    const id = setInterval(load, 30_000);
    window.addEventListener("storage", load);
    return () => (clearInterval(id), window.removeEventListener("storage", load));
  }, [refreshKey]);

  if (!seats.length) return null;
  return (
    <Box component="section" aria-labelledby="your-rounds-h" sx={{ display: "grid", gap: 1 }}>
      <Typography id="your-rounds-h" sx={{ fontSize: 14, fontWeight: 700 }}>
        Your rounds
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, border: `1px solid ${hall.line}`, borderRadius: "12px" }}>
        {seats.map(({ ticket, booking }) => (
          <Box
            component="li"
            key={ticket}
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, px: 1.75, py: 1.25, "& + &": { borderTop: `1px solid ${hall.lineSoft}` } }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {slotLabel(booking.slotId, now, timeZone)} · {booking.role === "seller" ? "Seller" : "Buyer"}
              </Typography>
              <Typography variant="body2" sx={{ color: hall.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                @{booking.handle} · {status(booking)}
              </Typography>
            </Box>
            <Button href={`/t#${ticket}`} variant="outlined" size="small" sx={{ flexShrink: 0 }}>
              Open round
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

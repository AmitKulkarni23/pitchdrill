"use client";

import { useEffect, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { api } from "@/lib/api";
import { dayLabel, groupSlotsByLocalDay, scheduleSlots, timeLabel, waitingLabel } from "@/lib/slots";
import { studio, strapType } from "@/config/tokens";
import type { SlotWithStats } from "@/types/api";
import { Arrow } from "./Arrow";
import { BookingDesk } from "./BookingDesk";

type GuideSlot = { slotId: string; stats: Omit<SlotWithStats, "slotId"> | null };

/** TV-listings guide: a channel strip of days, then that day's slots as listing tiles. */
export function ProgramGuide() {
  const now = useNow();
  const timeZone = useTimeZone();
  const [remote, setRemote] = useState<SlotWithStats[] | "unavailable" | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [booking, setBooking] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ slots: SlotWithStats[] }>("/slots")
      .then((r) => setRemote(r.slots))
      .catch(() => setRemote("unavailable"));
  }, []);

  if (now === null || timeZone === null || remote === null) {
    return <Box sx={{ height: 420, bgcolor: studio.cobaltDeep, opacity: 0.5 }} aria-busy="true" aria-label="Loading the program guide" />;
  }

  const slots: GuideSlot[] = Array.isArray(remote)
    ? remote.filter((s) => Date.parse(s.slotId) - 5 * 60_000 >= now).map(({ slotId, ...stats }) => ({ slotId, stats }))
    : scheduleSlots(now).map((slotId) => ({ slotId, stats: null }));
  const days = groupSlotsByLocalDay(slots, timeZone);
  const active = days.find((d) => d.dayKey === day) ?? days[0];

  if (!active) {
    return <Typography sx={{ color: studio.haze }}>No slots are open right now. New slots open daily, 7 days ahead.</Typography>;
  }

  return (
    <Box>
      <Box role="tablist" aria-label="Day" sx={{ display: "flex", gap: "2px", overflowX: "auto", bgcolor: studio.cobaltLine, border: `2px solid ${studio.cobaltLine}` }}>
        {days.map((d) => {
          const selected = d.dayKey === active.dayKey;
          return (
            <ButtonBase
              key={d.dayKey}
              role="tab"
              aria-selected={selected}
              onClick={() => setDay(d.dayKey)}
              sx={{
                ...strapType,
                flex: "1 0 auto",
                minWidth: 112,
                px: 2,
                py: 1.5,
                fontSize: "1.0625rem",
                bgcolor: selected ? studio.signal : studio.cobaltNight,
                color: selected ? studio.ink : "#fff",
                transition: "background-color 160ms",
                "&:hover": { bgcolor: selected ? studio.signal : studio.cobaltDeep },
              }}
            >
              {dayLabel(d.dayKey, now, timeZone)}
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        role="tabpanel"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
          gap: "2px",
          bgcolor: studio.cobaltNight,
          border: `2px solid ${studio.cobaltLine}`,
          borderTop: 0,
        }}
      >
        {active.slots.map((slot) => {
          const label = waitingLabel(slot.stats);
          const waiting = !!slot.stats && (slot.stats.waitingSellers > 0 || slot.stats.waitingBuyers > 0);
          return (
            <ButtonBase
              key={slot.slotId}
              onClick={() => setBooking(slot.slotId)}
              aria-label={`Book ${timeLabel(slot.slotId, timeZone)}, ${label}`}
              sx={{
                position: "relative",
                display: "grid",
                justifyItems: "start",
                alignContent: "start",
                gap: 0.75,
                textAlign: "left",
                p: 2,
                minHeight: 112,
                bgcolor: studio.cobaltDeep,
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  bgcolor: studio.signal,
                  transform: waiting ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                },
                "&:hover, &:focus-visible": { bgcolor: studio.cobaltNight },
                "&:hover::before, &:focus-visible::before": { transform: "scaleX(1)" },
                "&:hover .book, &:focus-visible .book": { color: studio.signal },
              }}
            >
              <Box sx={{ ...strapType, fontSize: "2rem", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{timeLabel(slot.slotId, timeZone)}</Box>
              <Box sx={{ fontSize: "0.875rem", fontWeight: 600, color: waiting ? studio.signal : studio.haze }}>{label}</Box>
              <Box className="book" sx={{ ...strapType, fontSize: "0.8125rem", letterSpacing: "0.1em", color: studio.hazeDim, mt: "auto", transition: "color 160ms" }}>
                Book <Arrow size={12} />
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Typography variant="body2" sx={{ color: studio.haze, mt: 1.5 }}>
        Times are in your time zone ({timeZone}). Booking closes 5 minutes before each round.
        {remote === "unavailable" && " Live seat counts appear once booking opens to the public."}
      </Typography>

      <BookingDesk slotId={booking} timeZone={timeZone} now={now} onClose={() => setBooking(null)} />
    </Box>
  );
}

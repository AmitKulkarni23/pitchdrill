"use client";

import { Box } from "@mui/material";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { studio, strapType } from "@/config/tokens";
import { dayLabel, scheduleSlots, timeLabel } from "@/lib/slots";

const until = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** Channel bug on the left, the next round's start and countdown on the right. */
export function TopBar() {
  const now = useNow();
  const timeZone = useTimeZone();
  // Next slot start at or after now (booking may already be closed for it).
  const next = now !== null ? scheduleSlots(now - 5 * 60_000)[0] : undefined;

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        bgcolor: studio.cobaltNight,
        borderBottom: `2px solid ${studio.cobaltLine}`,
      }}
    >
      <Box component="a" href="/" sx={{ display: "flex", alignItems: "stretch", textDecoration: "none" }} aria-label="PitchDrill home">
        <Box sx={{ ...strapType, fontWeight: 900, fontSize: "1.375rem", bgcolor: studio.signal, color: studio.ink, px: 1.75, display: "flex", alignItems: "center" }}>
          Pitch
        </Box>
        <Box sx={{ ...strapType, fontWeight: 900, fontSize: "1.375rem", color: "#fff", px: 1.25, display: "flex", alignItems: "center" }}>
          Drill
        </Box>
      </Box>

      {next && timeZone && now !== null && (
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.5 }, pr: { xs: 1.5, sm: 2.5 }, py: 1 }}>
          <Box sx={{ ...strapType, fontSize: "0.75rem", letterSpacing: "0.12em", color: studio.haze, display: { xs: "none", sm: "block" } }}>
            Next round
          </Box>
          <Box sx={{ ...strapType, fontSize: "1.125rem" }}>
            {dayLabel(new Intl.DateTimeFormat("en-CA", { timeZone }).format(Date.parse(next)), now, timeZone)} {timeLabel(next, timeZone)}
          </Box>
          <Box sx={{ ...strapType, fontSize: "1.125rem", color: studio.signal, minWidth: "4.5ch", textAlign: "right" }}>
            {until(Date.parse(next) - now)}
          </Box>
        </Box>
      )}
    </Box>
  );
}

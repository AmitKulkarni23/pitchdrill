"use client";

import { Box, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import type { PhaseResult } from "@/lib/arena";
import { formatCountdown } from "@/lib/time";

/** The big clock: countdown to air, then 60 to 0 (red for the last ten seconds), then the buzzer. */
export function RoundTimer({ result }: { result: PhaseResult }) {
  const { phase, secondsLeft, untilMs } = result;
  const urgent = phase === "live" && (secondsLeft ?? 60) <= 10;
  const text =
    phase === "live" ? String(secondsLeft) : phase === "buzzer" ? "BUZZER!" : phase === "brief" || phase === "pre-brief" ? formatCountdown((untilMs ?? 0) + (phase === "pre-brief" ? 30_000 : 0)) : phase === "starting" ? "Starting…" : "";
  const label = phase === "live" ? "On air" : phase === "buzzer" ? "Time" : phase === "pre-brief" || phase === "brief" ? "On air in" : "";
  return (
    <Box sx={{ textAlign: "center" }} role="timer" aria-live="off">
      <Typography sx={{ ...strapType, fontSize: "0.875rem", letterSpacing: "0.12em", color: studio.haze }}>{label}</Typography>
      <Typography sx={{ ...strapType, fontSize: { xs: "4rem", sm: "6rem" }, color: urgent || phase === "buzzer" ? studio.onAir : studio.signal }}>{text}</Typography>
    </Box>
  );
}

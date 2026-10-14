import { Box } from "@mui/material";
import { studio, strapType } from "@/config/theme";

export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The on-air countdown: red tag while live, the digits turn red in the last ten seconds. */
export function OnAirClock({ seconds, live, size = "md" }: { seconds: number; live: boolean; size?: "md" | "lg" }) {
  const urgent = live && seconds <= 10;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "stretch", bgcolor: studio.cobaltNight }} role="timer" aria-live="off">
      <Box
        sx={{
          ...strapType,
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          px: 1,
          display: "flex",
          alignItems: "center",
          bgcolor: live ? studio.onAir : studio.cobaltLine,
          color: "#fff",
        }}
      >
        {live ? "On air" : "Standby"}
      </Box>
      <Box
        sx={{
          ...strapType,
          fontVariantNumeric: "tabular-nums",
          fontSize: size === "lg" ? "2.75rem" : "1.75rem",
          px: 1.5,
          py: 0.5,
          color: urgent ? "#ff5a68" : "#fff",
          transition: "color 200ms",
        }}
      >
        {formatClock(seconds)}
      </Box>
    </Box>
  );
}

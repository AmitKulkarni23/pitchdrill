import { Box, Typography } from "@mui/material";
import { SiteHeader } from "@/components/home/SiteHeader";
import { hall } from "@/config/tokens";
import { countdown } from "@/lib/slots";
import type { BriefPoints, PublicRound } from "@/types/api";

export function RoundShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <Box component="main" sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3 }, pt: { xs: 3, sm: 4 }, pb: 8, display: "grid", gap: 2.5 }}>
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Typography variant="h1">{title}</Typography>
          {subtitle && <Typography sx={{ color: hall.muted }}>{subtitle}</Typography>}
        </Box>
        {children}
      </Box>
    </>
  );
}

/** A brief as a bulleted list; older rounds stored it as one paragraph. */
export function BriefList({ points, muted }: { points: BriefPoints; muted?: boolean }) {
  if (typeof points === "string") return <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: muted ? hall.muted : hall.ink }}>{points}</Typography>;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.5, typography: "body2" }}>
      {points.map((p, i) => <li key={i}>{p}</li>)}
    </Box>
  );
}

/** Big status line: countdown to start, time left, buzzer, or outcome. */
export function RoundClock({ round, now }: { round: PublicRound; now: number }) {
  const start = Date.parse(round.slotId);
  const [label, value, live] =
    round.status === "live" && round.endsAt
      ? now < Date.parse(round.endsAt)
        ? ["Time left", countdown(Date.parse(round.endsAt) - now), true]
        : ["Buzzer!", "0:00", false]
      : round.status === "ready" || round.status === "paired"
        ? start - now > 3000
          ? ["Starts in", countdown(start - now), false]
          : now < start
            ? ["Get ready", String(Math.ceil((start - now) / 1000)), false]
            : ["Starting", "waiting for both players…", false]
        : round.status === "cancelled"
          ? ["Cancelled", round.cancelReason === "no_show" ? "a player didn't show up" : "ended by a moderator", false]
          : ["Played", new Date(round.startedAt ?? round.slotId).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), false];
  return (
    <Box role="timer" aria-live="off" sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap" }}>
      <Typography sx={{ fontWeight: 800, color: live ? hall.live : hall.ink, fontSize: 15 }}>{live && "● "}{label}</Typography>
      <Typography data-testid="clock" sx={{ fontWeight: 800, fontSize: { xs: 28, sm: 34 }, letterSpacing: "-0.02em" }}>{value}</Typography>
    </Box>
  );
}

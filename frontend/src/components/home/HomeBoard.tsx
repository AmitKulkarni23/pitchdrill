"use client";

import { useEffect, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { api } from "@/lib/api";
import { countdown, dayLabel, groupSlotsByLocalDay, isFull, MAX_PER_ROLE, scheduleSlots, seatsLabel, slotLabel, timeLabel, waitHint } from "@/lib/slots";
import { hall, panel } from "@/config/tokens";
import type { SlotWithStats } from "@/types/api";
import { LiveTile, type LiveRound } from "./LiveTile";
import { PlayPanel } from "./PlayPanel";

type Slot = { slotId: string; stats: Omit<SlotWithStats, "slotId"> | null };

// TEMPORARY sample live rounds so the Watch grid is visible before GET /rounds/live (TASK-009) exists.
// Set to false (or delete with DEMO/demoRounds) before going public; TASK-018 replaces it with real data.
const SHOW_DEMO = true;
const DEMO = [
  ["Noise-cancelling headphones", "maya_k", "dan_r"],
  ["Standing desk converter", "priya_s", "tom_b"],
  ["Cold brew subscription", "jordan_l", "sam_w"],
  ["Password manager for families", "aisha_m", "leo_t"],
] as const;
// Sample seat counts for the first few upcoming slots (sellers, buyers, waiting sellers, waiting buyers).
const DEMO_STATS = [
  [1, 0, 1, 0],
  [4, 2, 2, 0],
  [0, 0, 0, 0],
  [4, 4, 0, 0],
  [2, 3, 0, 1],
].map(([sellers, buyers, waitingSellers, waitingBuyers]) => ({ sellers, buyers, waitingSellers, waitingBuyers, rounds: Math.min(sellers, buyers) }));
function demoRounds(now: number): LiveRound[] {
  const minute = now - (now % 60_000);
  return DEMO.map(([product, sellerHandle, buyerHandle], i) => ({ roundId: `demo-${i}`, product, sellerHandle, buyerHandle, endsAt: minute + 60_000 - i * 4_000 }));
}

const row = { display: "flex", flexWrap: "wrap", gap: 2.5, alignItems: "stretch" } as const;

/** Watch + Play, then the slot list. Shares the picked slot between the list and the Play panel. */
export function HomeBoard({ howItWorks }: { howItWorks: React.ReactNode }) {
  const now = useNow();
  const timeZone = useTimeZone();
  const [remote, setRemote] = useState<SlotWithStats[] | "unavailable" | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const demo = SHOW_DEMO;

  useEffect(() => {
    api
      .get<{ slots: SlotWithStats[] }>("/slots")
      .then((r) => setRemote(r.slots))
      .catch(() => setRemote("unavailable"));
  }, []);

  if (now === null || timeZone === null || remote === null) {
    return (
      <Box aria-busy="true" aria-label="Loading today's rounds" sx={{ display: "grid", gap: 2.5 }}>
        <Box sx={row}>
          <Box sx={{ ...panel, flex: "7 1 520px", height: 380 }} />
          <Box sx={{ ...panel, flex: "5 1 340px", height: 380 }} />
        </Box>
      </Box>
    );
  }

  const slots: Slot[] = Array.isArray(remote)
    ? remote.filter((s) => Date.parse(s.slotId) - 5 * 60_000 >= now).map(({ slotId, ...stats }) => ({ slotId, stats }))
    : scheduleSlots(now).map((slotId, i) => ({ slotId, stats: (demo && DEMO_STATS[i]) || null }));
  // A picked slot can close while the page sits open; fall back to the next one.
  const selected = slots.find((s) => s.slotId === picked && !isFull(s.stats))?.slotId ?? slots.find((s) => !isFull(s.stats))?.slotId ?? null;
  const next = slots[0]?.slotId;
  const live = demo ? demoRounds(now) : [];
  const liveSlot = new Date(now - (now % (15 * 60_000))).toISOString();
  const days = groupSlotsByLocalDay(slots, timeZone);
  const active = days.find((d) => d.dayKey === day) ?? days[0];

  function pick(slotId: string) {
    setPicked(slotId);
    document.getElementById("play")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <Box sx={row}>
        <Box component="section" id="watch" aria-labelledby="watch-h" sx={{ ...panel, flex: "7 1 520px", minWidth: 0, p: { xs: 2, sm: 2.75 }, display: "grid", gap: 2.25, gridTemplateRows: "auto 1fr", scrollMarginTop: 80 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
            <Typography id="watch-h" variant="h2">
              Watch
            </Typography>
            {live.length > 0 && (
              <Typography variant="body2" sx={{ color: hall.muted }}>
                {timeLabel(liveSlot, timeZone)} slot · {live.length} {live.length === 1 ? "round" : "rounds"} live{demo && " · sample data"}
              </Typography>
            )}
          </Box>
          {live.length > 0 ? (
            <Box sx={{ display: "grid", gap: 2.25, alignContent: "start" }}>
              {/* At most MAX_PER_ROLE rounds per slot, so a 2×2 grid always fits; one round gets the full width. */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: live.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))" }, gap: 2, rowGap: 2.5 }}>
                {live.slice(0, MAX_PER_ROLE).map((r) => (
                  <LiveTile key={r.roundId} round={r} now={now} />
                ))}
              </Box>
              {next && (
                <Typography variant="body2" sx={{ color: hall.muted, pt: 1.75, borderTop: `1px solid ${hall.lineSoft}` }}>
                  Up next: {slotLabel(next, now, timeZone)} slot
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ border: `2px dashed ${hall.field}`, borderRadius: "12px", p: { xs: 3, sm: 4 }, display: "grid", placeItems: "center", alignContent: "center", gap: 1.25, textAlign: "center" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: hall.muted }}>Nothing live right now</Typography>
              {next ? (
                <>
                  <Typography sx={{ fontSize: { xs: 36, sm: 44 }, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{slotLabel(next, now, timeZone)}</Typography>
                  <Typography sx={{ color: hall.muted, maxWidth: "38ch" }}>
                    Next rounds start in {countdown(Date.parse(next) - now)}. Come back to watch, or take a seat.
                  </Typography>
                </>
              ) : (
                <Typography sx={{ color: hall.muted }}>Rounds run every 15 minutes, 4:00 to 8:45 PM Pacific.</Typography>
              )}
            </Box>
          )}
        </Box>

        <PlayPanel slotId={selected} timeZone={timeZone} now={now} />
      </Box>

      <Box sx={row}>
        <Box component="section" aria-labelledby="slots-h" sx={{ flex: "7 1 520px", minWidth: 0, display: "grid", gap: 1.75, alignContent: "start" }}>
          <Box>
            <Typography id="slots-h" variant="h2">
              Upcoming slots
            </Typography>
            <Typography variant="body2" sx={{ color: hall.muted }}>
              Replays of every round will appear here once the first rounds run.
            </Typography>
          </Box>

          {active ? (
            <>
              <Box role="tablist" aria-label="Day" sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.5 }}>
                {days.map((d) => {
                  const on = d.dayKey === active.dayKey;
                  return (
                    <ButtonBase
                      key={d.dayKey}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setDay(d.dayKey)}
                      sx={{
                        flexShrink: 0,
                        px: 1.75,
                        py: 1,
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 700,
                        bgcolor: on ? hall.ink : hall.panel,
                        color: on ? "#fff" : hall.ink,
                        boxShadow: on ? "none" : `inset 0 0 0 1px ${hall.field}`,
                        "&:hover": { boxShadow: on ? "none" : `inset 0 0 0 1px ${hall.ink}` },
                      }}
                    >
                      {dayLabel(d.dayKey, now, timeZone)}
                    </ButtonBase>
                  );
                })}
              </Box>
              <Box role="tabpanel" component="ul" sx={{ ...panel, m: 0, p: 0, listStyle: "none", overflow: "hidden" }}>
                {active.slots.map((s, i) => {
                  const on = s.slotId === selected;
                  const full = isFull(s.stats);
                  const label = seatsLabel(s.stats);
                  const hint = waitHint(s.stats);
                  return (
                    <Box component="li" key={s.slotId} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, px: 2.25, py: 1.5, borderTop: i ? `1px solid ${hall.lineSoft}` : 0, bgcolor: on ? hall.greenTint : "transparent" }}>
                      <Box sx={{ width: 92, fontSize: 18, fontWeight: 800 }}>{timeLabel(s.slotId, timeZone)}</Box>
                      <Box sx={{ flex: "999 1 200px", display: "grid", gap: 0.25 }}>
                        <Box sx={{ fontSize: 14, fontWeight: 600, color: full ? hall.muted : hall.ink }}>{label}</Box>
                        {hint && <Box sx={{ fontSize: 13, fontWeight: 600, color: hall.greenDeep }}>{hint}</Box>}
                      </Box>
                      <ButtonBase
                        aria-pressed={on}
                        disabled={full}
                        aria-label={`Book ${timeLabel(s.slotId, timeZone)}, ${label}${hint ? `. ${hint}` : ""}`}
                        onClick={() => pick(s.slotId)}
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          px: 1.5,
                          py: 1,
                          minHeight: 40,
                          borderRadius: "8px",
                          bgcolor: on ? hall.green : hall.panel,
                          color: on ? "#fff" : hall.ink,
                          boxShadow: on ? "none" : `inset 0 0 0 1px ${hall.field}`,
                          "&:hover": { boxShadow: on ? "none" : `inset 0 0 0 1px ${hall.ink}` },
                          "&.Mui-disabled": { color: hall.muted, bgcolor: hall.chip, boxShadow: "none" },
                        }}
                      >
                        {full ? "Full" : on ? "Selected" : "Book"}
                      </ButtonBase>
                    </Box>
                  );
                })}
              </Box>
              <Typography variant="body2" sx={{ color: hall.muted }}>
                Times are in your time zone ({timeZone}). Booking closes 5 minutes before each round.
                {demo ? " Seat counts shown are sample data." : remote === "unavailable" && " Seat counts appear once booking opens to the public."}
              </Typography>
            </>
          ) : (
            <Typography sx={{ color: hall.muted }}>No slots are open right now. New slots open daily, 7 days ahead.</Typography>
          )}
        </Box>

        {howItWorks}
      </Box>
    </>
  );
}

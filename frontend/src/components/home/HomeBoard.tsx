"use client";

import { useEffect, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { useNow, useTimeZone } from "@/hooks/useClock";
import { api } from "@/lib/api";
import { countdown, dayLabel, groupSlotsByLocalDay, scheduleSlots, slotLabel, timeLabel, waitingLabel } from "@/lib/slots";
import { hall, panel } from "@/config/tokens";
import type { SlotWithStats } from "@/types/api";
import { PlayPanel } from "./PlayPanel";

type Slot = { slotId: string; stats: Omit<SlotWithStats, "slotId"> | null };

const row = { display: "flex", flexWrap: "wrap", gap: 2.5, alignItems: "stretch" } as const;

/** Watch + Play, then the slot list. Shares the picked slot between the list and the Play panel. */
export function HomeBoard({ howItWorks }: { howItWorks: React.ReactNode }) {
  const now = useNow();
  const timeZone = useTimeZone();
  const [remote, setRemote] = useState<SlotWithStats[] | "unavailable" | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

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
    : scheduleSlots(now).map((slotId) => ({ slotId, stats: null }));
  // A picked slot can close while the page sits open; fall back to the next one.
  const selected = slots.find((s) => s.slotId === picked)?.slotId ?? slots[0]?.slotId ?? null;
  const next = slots[0]?.slotId;
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
          <Typography id="watch-h" variant="h2">
            Watch
          </Typography>
          {/* ponytail: always the empty state until GET /rounds/live (TASK-009) and the spectator view (TASK-018) exist. */}
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
                  const label = waitingLabel(s.stats);
                  return (
                    <Box component="li" key={s.slotId} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, px: 2.25, py: 1.5, borderTop: i ? `1px solid ${hall.lineSoft}` : 0, bgcolor: on ? hall.greenTint : "transparent" }}>
                      <Box sx={{ width: 92, fontSize: 18, fontWeight: 800 }}>{timeLabel(s.slotId, timeZone)}</Box>
                      <Box sx={{ flex: "999 1 180px", fontSize: 14, color: on ? hall.greenDeep : hall.muted }}>{label}</Box>
                      <ButtonBase
                        aria-pressed={on}
                        aria-label={`Book ${timeLabel(s.slotId, timeZone)}, ${label}`}
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
                        }}
                      >
                        {on ? "Selected" : "Book"}
                      </ButtonBase>
                    </Box>
                  );
                })}
              </Box>
              <Typography variant="body2" sx={{ color: hall.muted }}>
                Times are in your time zone ({timeZone}). Booking closes 5 minutes before each round.
                {remote === "unavailable" && " Seat counts appear once booking opens to the public."}
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

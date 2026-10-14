"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";
import { usePolling } from "@/hooks/usePolling";
import { api, ApiError } from "@/lib/api";
import type { Role } from "@/types/api";

interface Brief {
  product: { name: string; price: string; tagline: string };
  brief: string;
  role: Role;
}

interface Props {
  ticket: string;
  roundId: string;
  /** True from T-30s: the server refuses earlier. */
  unlocked: boolean;
  /** Milliseconds until it unlocks, shown before then. */
  unlocksInMs?: number;
}

/** Your own side's brief. The buyer persona is never shown to the seller; the server enforces that. */
export function BriefPanel({ ticket, roundId, unlocked, unlocksInMs }: Props) {
  const [brief, setBrief] = useState<Brief>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const res = await api.get<Brief>(`/rounds/${roundId}/brief`, { ticket });
      setBrief(res);
      setError(undefined);
    } catch (e) {
      // brief_not_yet / brief_pending resolve on their own; the poll below retries every 3s.
      if (!(e instanceof ApiError && (e.code === "brief_not_yet" || e.code === "brief_pending"))) setError(e instanceof Error ? e.message : "Couldn't load your brief.");
    }
  }, [ticket, roundId]);

  useEffect(() => {
    if (!unlocked || brief) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [unlocked, brief, load]);
  usePolling(load, unlocked && !brief ? 3000 : null);

  return (
    <Box sx={{ bgcolor: studio.plate, color: studio.ink, p: 2.5, display: "grid", gap: 1 }} aria-live="polite">
      {!unlocked && (
        <Typography>
          Your brief unlocks 30 seconds before the round{unlocksInMs !== undefined ? ` (in ${Math.ceil(unlocksInMs / 1000)}s)` : ""}.
        </Typography>
      )}
      {unlocked && !brief && !error && <Typography>Loading your brief…</Typography>}
      {error && <Typography color="error">{error}</Typography>}
      {brief && (
        <>
          <Typography sx={{ ...strapType, fontSize: "0.8125rem", letterSpacing: "0.1em", color: "#2a3380" }}>
            {brief.role === "seller" ? "Your product" : "Your persona (secret)"}
          </Typography>
          <Typography sx={{ ...strapType, fontSize: "1.75rem" }}>
            {brief.product.name} · {brief.product.price}
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>{brief.product.tagline}</Typography>
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{brief.brief}</Typography>
        </>
      )}
    </Box>
  );
}

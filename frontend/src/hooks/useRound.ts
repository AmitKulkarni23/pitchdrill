"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PublicRound } from "@/types/api";

/** Polls a round while it can still change; stops once it's closed or cancelled. */
export function useRound(roundId: string | undefined, intervalMs = 3000) {
  const [round, setRound] = useState<PublicRound | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    if (!roundId) return;
    try {
      setRound((await api.get<{ round: PublicRound }>(`/rounds/${roundId}`)).round);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "unknown", "Something went wrong."));
    }
  }, [roundId]);

  const settled = round?.status === "closed" || round?.status === "cancelled";
  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    if (settled) clearInterval(id);
    // First load right away; the interval keeps it fresh until the round settles.
    const first = setTimeout(refresh, 0);
    return () => (clearInterval(id), clearTimeout(first));
  }, [refresh, intervalMs, settled]);

  return { round, setRound, error, refresh };
}

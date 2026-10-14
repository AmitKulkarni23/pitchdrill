"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `fn` every `intervalMs` while the page is visible (null = never). Pauses when the tab is hidden
 * and refreshes immediately when it becomes visible again.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number | null) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (intervalMs === null) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (!timer) timer = setInterval(() => void latest.current(), intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void latest.current();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}

"use client";

import { useSyncExternalStore } from "react";

// One shared 1-second ticker for every clock on the page. Server render gets null (no clock until hydrated).
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export const useNow = (): number | null =>
  useSyncExternalStore(subscribe, () => now, () => null);

const noop = () => () => {};
export const useTimeZone = (): string | null =>
  useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);

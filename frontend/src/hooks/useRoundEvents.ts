"use client";

import { useEffect, useRef } from "react";
import { parseRoundEvent, type RoundEvent } from "@/lib/arena";

export interface ChatTokenValue {
  token: string;
  sessionExpirationTime: string;
  tokenExpirationTime: string;
}

/** Connects to a round's IVS Chat room with `chatToken` and reports typed round events. Disconnects on cleanup. */
export function useRoundEvents(chatToken: ChatTokenValue | null, onEvent: (event: RoundEvent) => void) {
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  });

  useEffect(() => {
    if (!chatToken) return;
    let cancelled = false;
    let disconnect: (() => void) | undefined;
    (async () => {
      const { ChatRoom } = await import("amazon-ivs-chat-messaging");
      if (cancelled) return;
      // The token is single use per connection; a reconnect past its expiry would need a fresh one from the API.
      const room = new ChatRoom({ regionOrUrl: "us-west-2", tokenProvider: async () => chatToken });
      room.addListener("event", (e) => {
        const parsed = parseRoundEvent(e);
        if (parsed) latest.current(parsed);
      });
      room.connect();
      disconnect = () => room.disconnect();
    })().catch(() => {
      // Chat is an enhancement: the 5s round poll keeps the arena correct without it.
    });
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [chatToken]);
}

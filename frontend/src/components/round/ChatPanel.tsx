"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { getNickname, getVoterId, setNickname } from "@/lib/storage";
import { reportError } from "@/lib/rum";
import { hall, panel } from "@/config/tokens";
import type { ChatToken } from "@/types/api";

type Line = { id: string; nickname: string; text: string };
export type RoundEvent = { name: string; attributes: Record<string, string> };

/**
 * Live chat over IVS Chat. Participants pass their receive-only token; spectators pick a nickname once
 * and get a send token. Server events (round_started, buzzer, tally, round_cancelled) go to `onEvent`.
 */
export function ChatPanel({ roundId, participantToken, onEvent }: { roundId: string; participantToken?: ChatToken; onEvent?: (e: RoundEvent) => void }) {
  const [nickname, setNick] = useState<string | null>(participantToken ? "" : getNickname() || null);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const roomRef = useRef<{ send: (text: string) => Promise<void> } | null>(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });
  const canSend = !participantToken;

  useEffect(() => {
    if (!participantToken && !nickname) return;
    let room: import("amazon-ivs-chat-messaging").ChatRoom | null = null;
    let stopped = false;
    (async () => {
      const { ChatRoom, SendMessageRequest } = await import("amazon-ivs-chat-messaging");
      const fetchToken = () => participantToken ?? api.post<ChatToken>(`/rounds/${roundId}/chat-token`, { voterId: getVoterId(), nickname });
      // First token up front, so a rejected nickname shows here instead of failing inside the chat SDK.
      let first: ChatToken | undefined;
      try {
        first = await fetchToken();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Chat is unavailable right now.");
        // A rejected nickname (a player's handle, bad characters) goes back to the picker.
        if (e instanceof ApiError && (e.code === "nickname_taken" || e.code === "bad_nickname")) {
          setNickname("");
          setNick(null);
        }
        return;
      }
      const tokenProvider = async () => {
        const t = first ?? (await fetchToken());
        first = undefined;
        return {
          token: t.token,
          sessionExpirationTime: t.sessionExpirationTime ? new Date(t.sessionExpirationTime) : undefined,
          tokenExpirationTime: t.tokenExpirationTime ? new Date(t.tokenExpirationTime) : undefined,
        };
      };
      if (stopped) return;
      room = new ChatRoom({ regionOrUrl: "us-west-2", tokenProvider });
      room.addListener("connect", () => setConnected(true));
      room.addListener("disconnect", () => setConnected(false));
      room.addListener("message", (m) =>
        setLines((l) => [...l.slice(-199), { id: m.id, nickname: String(m.sender.attributes?.nickname ?? "someone"), text: m.content }]),
      );
      room.addListener("event", (e) => onEventRef.current?.({ name: e.eventName, attributes: (e.attributes ?? {}) as Record<string, string> }));
      roomRef.current = { send: async (text) => void (await room!.sendMessage(new SendMessageRequest(text))) };
      try {
        room.connect();
      } catch (e) {
        reportError(e);
        setError("Chat is unavailable right now.");
      }
    })().catch((e) => {
      if (!(e instanceof ApiError)) reportError(e); // API failures are already captured by RUM's http telemetry
      setError(e instanceof ApiError ? e.message : "Chat is unavailable right now.");
    });
    return () => {
      stopped = true;
      room?.disconnect();
    };
  }, [roundId, participantToken, nickname]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !roomRef.current) return;
    try {
      await roomRef.current.send(text.slice(0, 500));
      setDraft("");
    } catch {
      setError("Message not sent. Try again.");
    }
  }

  return (
    <Box component="section" aria-label="Chat" sx={{ ...panel, p: 2, display: "grid", gap: 1.25, alignContent: "start", minHeight: 280 }}>
      <Typography sx={{ fontWeight: 800 }}>Chat {connected && <Box component="span" sx={{ color: hall.muted, fontWeight: 600, fontSize: 13 }}>· connected</Box>}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {nickname === null ? (
        <NicknameForm onPick={(n) => (setError(null), setNickname(n), setNick(n))} />
      ) : (
        <>
          <Box aria-live="polite" sx={{ display: "grid", gap: 0.5, maxHeight: 320, overflowY: "auto", alignContent: "start", fontSize: 14 }}>
            {lines.length === 0 && <Typography variant="body2" sx={{ color: hall.muted }}>No messages yet.</Typography>}
            {lines.map((l) => (
              <Box key={l.id}>
                <Box component="span" sx={{ fontWeight: 700 }}>{l.nickname}</Box> {l.text}
              </Box>
            ))}
          </Box>
          {canSend && (
            <Box component="form" onSubmit={send} sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Chat as ${nickname}`} fullWidth slotProps={{ htmlInput: { maxLength: 500, "aria-label": "Message" } }} />
              <Button type="submit" variant="contained" disabled={!connected}>Send</Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

const NICK_RE = /^[A-Za-z0-9 _.\-]{2,20}$/;

export function NicknameForm({ onPick, cta = "Join chat" }: { onPick: (n: string) => void; cta?: string }) {
  const [value, setValue] = useState("");
  const ok = NICK_RE.test(value.trim());
  return (
    <Box component="form" onSubmit={(e) => (e.preventDefault(), ok && onPick(value.trim()))} sx={{ display: "flex", gap: 1, alignItems: "start" }}>
      <TextField size="small" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Pick a nickname" helperText="2–20 letters, numbers, spaces or _ - ." fullWidth slotProps={{ htmlInput: { maxLength: 20, "aria-label": "Nickname" } }} sx={{ "& .MuiFormHelperText-root": { mx: 0 } }} />
      <Button type="submit" variant="contained" disabled={!ok}>{cta}</Button>
    </Box>
  );
}

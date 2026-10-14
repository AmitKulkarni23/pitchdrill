"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { NicknameDialog } from "@/components/NicknameDialog";
import { studio } from "@/config/tokens";
import { api, ApiError } from "@/lib/api";
import { parseRoundEvent, type RoundEvent } from "@/lib/arena";
import { getNickname, getVoterId, setNickname } from "@/lib/storage";
import type { ChatTokenValue } from "@/hooks/useRoundEvents";

interface Message {
  id: string;
  nickname: string;
  text: string;
}

interface Props {
  roundId: string;
  onEvent: (event: RoundEvent) => void;
}

type SendFn = (text: string) => Promise<unknown>;

/** Live chat. Connects once a nickname exists (asked on first focus) and also relays round events upward. */
export function ChatPanel({ roundId, onEvent }: Props) {
  const [nickname, setNick] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useRef<SendFn | null>(null);
  const latest = useRef(onEvent);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latest.current = onEvent;
  });
  useEffect(() => {
    const t = setTimeout(() => setNick(getNickname()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;
    let disconnect: (() => void) | undefined;
    (async () => {
      const { ChatRoom, SendMessageRequest } = await import("amazon-ivs-chat-messaging");
      if (cancelled) return;
      const room = new ChatRoom({
        regionOrUrl: "us-west-2",
        tokenProvider: async () => {
          const t = await api.post<ChatTokenValue>(`/rounds/${roundId}/chat-token`, { voterId: getVoterId(), nickname });
          return { token: t.token, sessionExpirationTime: new Date(t.sessionExpirationTime), tokenExpirationTime: new Date(t.tokenExpirationTime) };
        },
      });
      room.addListener("connect", () => setConnected(true));
      room.addListener("disconnect", () => setConnected(false));
      room.addListener("message", (m) => setMessages((prev) => [...prev.slice(-199), { id: m.id, nickname: m.sender.attributes?.nickname ?? "viewer", text: m.content }]));
      room.addListener("event", (e) => {
        const parsed = parseRoundEvent(e);
        if (parsed) latest.current(parsed);
      });
      send.current = (content) => room.sendMessage(new SendMessageRequest(content));
      room.connect();
      disconnect = () => room.disconnect();
    })().catch((e) => {
      if (cancelled) return;
      if (e instanceof ApiError && e.code === "nickname_taken") {
        setNickError(e.message);
        setNick(null);
        setAsking(true);
      } else setError(e instanceof Error ? e.message : "Chat isn't available right now.");
    });
    return () => {
      cancelled = true;
      send.current = null;
      disconnect?.();
      setConnected(false);
    };
  }, [nickname, roundId]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !send.current) return;
    setText("");
    try {
      await send.current(content);
    } catch {
      setError("Message not sent. Try again.");
    }
  }

  return (
    <Box sx={{ display: "grid", gridTemplateRows: "1fr auto", gap: 1, minHeight: 280, bgcolor: studio.cobaltDeep, border: `2px solid ${studio.cobaltLine}`, p: 1.5 }}>
      <Box ref={list} role="log" aria-live="polite" sx={{ overflowY: "auto", maxHeight: 360, display: "grid", gap: 0.75, alignContent: "start" }}>
        {messages.length === 0 && <Typography sx={{ color: studio.hazeDim }}>{connected ? "Say something." : "Pick a nickname to join the chat."}</Typography>}
        {messages.map((m) => (
          <Typography key={m.id} sx={{ overflowWrap: "anywhere" }}>
            <Box component="span" sx={{ color: studio.signal, fontWeight: 700 }}>{m.nickname}</Box> {m.text}
          </Typography>
        ))}
      </Box>
      {error && <Typography color="error" variant="body2">{error}</Typography>}
      <Box component="form" onSubmit={submit} sx={{ display: "flex", gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder={nickname ? "Message" : "Click to pick a nickname"}
          value={text}
          onFocus={() => !nickname && setAsking(true)}
          onChange={(e) => setText(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 500, "aria-label": "Chat message" } }}
        />
        <Button type="submit" variant="contained" disabled={!connected || !text.trim()}>Send</Button>
      </Box>
      <NicknameDialog
        open={asking}
        error={nickError}
        onClose={() => setAsking(false)}
        onSave={(n) => {
          setNickname(n);
          setNickError(null);
          setNick(n);
          setAsking(false);
        }}
      />
    </Box>
  );
}

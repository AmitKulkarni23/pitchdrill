"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { getNickname, getVoterId, setNickname } from "@/lib/storage";
import { hall, panel } from "@/config/tokens";
import type { Comment } from "@/types/api";
import { NicknameForm } from "./ChatPanel";

/** Comments on a finished round, oldest first, plus a one-time report link. */
export function CommentsPanel({ roundId, open }: { roundId: string; open: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [nickname, setNick] = useState<string | null>(getNickname);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    const r = await api.get<{ comments: Comment[]; nextCursor?: string }>(`/rounds/${roundId}/comments${cursor ? `?cursor=${cursor}` : ""}`);
    setComments((c) => (cursor ? [...c, ...r.comments] : r.comments));
    setNext(r.nextCursor);
  }, [roundId]);

  useEffect(() => {
    const first = setTimeout(() => load().catch(() => setError("Couldn't load comments.")), 0);
    return () => clearTimeout(first);
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { comment } = await api.post<{ comment: Comment }>(`/rounds/${roundId}/comments`, { voterId: getVoterId(), nickname, text });
      setComments((c) => [...c, comment]);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Comment not posted. Try again.");
    }
  }

  return (
    <Box component="section" aria-label="Comments" sx={{ ...panel, p: 2, display: "grid", gap: 1.5, alignContent: "start" }}>
      <Typography sx={{ fontWeight: 800 }}>Comments</Typography>
      {comments.length === 0 && <Typography variant="body2" sx={{ color: hall.muted }}>No comments yet.</Typography>}
      {comments.map((c) => (
        <Box key={c.commentId} sx={{ fontSize: 14 }}>
          <Box component="span" sx={{ fontWeight: 700 }}>{c.nickname}</Box> {c.text}
        </Box>
      ))}
      {next && <Button onClick={() => load(next)} sx={{ justifySelf: "start" }}>Load more</Button>}
      {error && <Alert severity="error">{error}</Alert>}
      {open &&
        (nickname ? (
          <Box component="form" onSubmit={post} sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Comment as ${nickname}`} fullWidth slotProps={{ htmlInput: { maxLength: 500, "aria-label": "Comment" } }} />
            <Button type="submit" variant="contained" disabled={!text.trim()}>Post</Button>
          </Box>
        ) : (
          <NicknameForm cta="Continue" onPick={(n) => (setNickname(n), setNick(n))} />
        ))}
      <ReportLink roundId={roundId} />
    </Box>
  );
}

function ReportLink({ roundId }: { roundId: string }) {
  const [state, setState] = useState<"idle" | "form" | "done">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (state === "done") return <Typography variant="body2" sx={{ color: hall.muted }}>Thanks, we&apos;ll take a look.</Typography>;
  if (state === "idle")
    return (
      <Button onClick={() => setState("form")} sx={{ justifySelf: "start", px: 0, color: hall.muted, fontSize: 13 }}>
        Report this round
      </Button>
    );
  return (
    <Box component="form" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api.post(`/rounds/${roundId}/reports`, { voterId: getVoterId(), reason });
        setState("done");
      } catch (err) {
        if (err instanceof ApiError && err.code === "already_reported") setState("done");
        else setError(err instanceof ApiError ? err.message : "Report not sent.");
      }
    }} sx={{ display: "grid", gap: 1 }}>
      <TextField size="small" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's wrong?" slotProps={{ htmlInput: { maxLength: 300, "aria-label": "Report reason" } }} />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="outlined" disabled={!reason.trim()} sx={{ justifySelf: "start" }}>Send report</Button>
    </Box>
  );
}

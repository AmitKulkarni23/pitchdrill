"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { NicknameDialog } from "@/components/NicknameDialog";
import { studio } from "@/config/tokens";
import { api, ApiError } from "@/lib/api";
import { appendPage } from "@/lib/pagination";
import { getNickname, getVoterId, setNickname } from "@/lib/storage";
import { isValidComment } from "@/lib/validation";

interface Comment {
  commentId: string;
  nickname: string;
  text: string;
  createdAt: string;
}

/** Comments under a replay: oldest first, load more, and a form that asks for a nickname once. */
export function Comments({ roundId }: { roundId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (from?: string) => {
      try {
        const res = await api.get<{ comments: Comment[]; nextCursor?: string }>(`/rounds/${roundId}/comments${from ? `?cursor=${encodeURIComponent(from)}` : ""}`);
        setComments((prev) => appendPage(from ? prev : [], res.comments, (c) => c.commentId));
        setCursor(res.nextCursor);
        setLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load comments.");
      }
    },
    [roundId],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function post(nickname: string) {
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api.post<{ comment: Comment }>(`/rounds/${roundId}/comments`, { voterId: getVoterId(), nickname, text: text.trim() });
      setComments((prev) => appendPage(prev, [comment], (c) => c.commentId));
      setText("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "nickname_taken") {
        setNickError(e.message);
        setAsking(true);
      } else setError(e instanceof Error ? e.message : "Couldn't post your comment.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidComment(text)) return;
    const nickname = getNickname();
    if (nickname) void post(nickname);
    else setAsking(true);
  }

  return (
    <Box component="section" aria-labelledby="comments-title" sx={{ display: "grid", gap: 2, maxWidth: 720 }}>
      <Typography id="comments-title" variant="h3">Comments</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 1 }}>
        <TextField
          multiline
          minRows={2}
          label="Add a comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          helperText={`${text.trim().length}/500`}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <Button type="submit" variant="contained" disabled={busy || !isValidComment(text)} sx={{ justifySelf: "start" }}>Post</Button>
      </Box>
      {loaded && comments.length === 0 && <Typography sx={{ color: studio.hazeDim }}>No comments yet. Be the first.</Typography>}
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.5 }}>
        {comments.map((c) => (
          <Box component="li" key={c.commentId}>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              <Box component="span" sx={{ color: studio.signal, fontWeight: 700 }}>{c.nickname}</Box> {c.text}
            </Typography>
          </Box>
        ))}
      </Box>
      {cursor && <Button variant="outlined" onClick={() => void load(cursor)} sx={{ justifySelf: "start" }}>Load more</Button>}
      <NicknameDialog
        open={asking}
        error={nickError}
        onClose={() => setAsking(false)}
        onSave={(n) => {
          setNickname(n);
          setNickError(null);
          setAsking(false);
          if (isValidComment(text)) void post(n);
        }}
      />
    </Box>
  );
}

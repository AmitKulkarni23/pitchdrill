"use client";

import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { getVoterId } from "@/lib/storage";
import { isValidReason } from "@/lib/validation";

/** Anyone can report a round; one report per browser. */
export function ReportDialog({ roundId, open, onClose }: { roundId: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ severity: "success" | "error" | "info"; text: string } | null>(null);
  const valid = isValidReason(reason);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await api.post(`/rounds/${roundId}/reports`, { voterId: getVoterId(), reason: reason.trim() });
      setMessage({ severity: "success", text: "Thanks, we'll take a look." });
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_reported") setMessage({ severity: "info", text: "You already reported this round. Thanks." });
      else setMessage({ severity: "error", text: err instanceof Error ? err.message : "Couldn't send your report." });
    } finally {
      setBusy(false);
    }
  }

  const done = message?.severity === "success" || message?.severity === "info";
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>Report this round</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          {message && <Alert severity={message.severity}>{message.text}</Alert>}
          {!done && (
            <TextField
              autoFocus
              multiline
              minRows={3}
              label="What's wrong?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              helperText={`${reason.trim().length}/300`}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{done ? "Close" : "Cancel"}</Button>
          {!done && <Button type="submit" variant="contained" disabled={!valid || busy}>Send report</Button>}
        </DialogActions>
      </form>
    </Dialog>
  );
}

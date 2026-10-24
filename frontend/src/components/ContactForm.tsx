"use client";

import { useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { hall, panel } from "@/config/tokens";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      await api.post("/contact", Object.fromEntries(new FormData(e.currentTarget)));
      setState("sent");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Message not sent. Try again.");
      setState("idle");
    }
  }

  if (state === "sent")
    return (
      <Box sx={{ ...panel, p: 3 }}>
        <Typography sx={{ fontWeight: 800 }}>Thanks, your message is on its way.</Typography>
        <Typography sx={{ color: hall.muted, mt: 0.5 }}>We&apos;ll reply to the email you gave.</Typography>
      </Box>
    );
  return (
    <Box component="form" onSubmit={send} sx={{ ...panel, p: 3, display: "grid", gap: 2 }}>
      <TextField name="name" label="Name" required slotProps={{ htmlInput: { maxLength: 60 } }} />
      <TextField name="email" type="email" label="Email" required slotProps={{ htmlInput: { maxLength: 254 } }} />
      <TextField name="message" label="Message" required multiline minRows={5} slotProps={{ htmlInput: { maxLength: 2000 } }} />
      {/* Honeypot: hidden from people and screen readers; bots that fill it are dropped by the API. */}
      <Box component="input" name="website" tabIndex={-1} autoComplete="off" aria-hidden sx={{ position: "absolute", left: "-9999px" }} />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" disabled={state === "sending"} sx={{ justifySelf: "start" }}>
        {state === "sending" ? "Sending…" : "Send message"}
      </Button>
    </Box>
  );
}

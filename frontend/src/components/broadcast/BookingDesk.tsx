"use client";

import { useState } from "react";
import { Alert, Box, Button, ButtonBase, Drawer, TextField, Typography, useMediaQuery } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { dayLabel, timeLabel } from "@/lib/slots";
import { addTicket } from "@/lib/storage";
import { isValidHandle } from "@/lib/validation";
import { studio, strapType } from "@/config/theme";
import type { CreateBookingResponse, Role } from "@/types/api";
import { Strap } from "./Strap";

const ROLES: { role: Role; tab: string; tone: "seller" | "buyer"; pitch: string }[] = [
  { role: "seller", tab: "Seller", tone: "seller", pitch: "You get a product 30 seconds before air. Sell it in 60." },
  { role: "buyer", tab: "Buyer", tone: "buyer", pitch: "You get a secret persona with a budget and doubts. Make them earn it." },
];

interface Props {
  slotId: string | null;
  timeZone: string;
  now: number;
  onClose: () => void;
}

/** One decision per step: role, then handle, then the ticket. */
export function BookingDesk({ slotId, timeZone, now, onClose }: Props) {
  const wide = useMediaQuery("(min-width: 720px)");
  const [role, setRole] = useState<Role | null>(null);
  const [handle, setHandle] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateBookingResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    onClose();
    setRole(null);
    setHandle("");
    setTouched(false);
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const when = slotId
    ? `${dayLabel(new Intl.DateTimeFormat("en-CA", { timeZone }).format(Date.parse(slotId)), now, timeZone)} · ${timeLabel(slotId, timeZone)}`
    : "";
  const handleOk = isValidHandle(handle);
  const link = result && typeof window !== "undefined" ? `${window.location.origin}/t/${result.ticket}` : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!slotId || !role || !handleOk) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<CreateBookingResponse>("/bookings", { slotId, handle, role });
      addTicket(res.ticket);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
      (document.getElementById("ticket-link") as HTMLInputElement | null)?.select();
    }
  }

  return (
    <Drawer
      anchor={wide ? "right" : "bottom"}
      open={!!slotId}
      onClose={close}
      slotProps={{
        paper: {
          sx: { width: wide ? 480 : "100%", maxHeight: wide ? "100%" : "92dvh", bgcolor: studio.cobaltNight, backgroundImage: "none", borderLeft: wide ? `2px solid ${studio.cobaltLine}` : 0 },
        },
      }}
    >
      <Box sx={{ p: { xs: 2.5, sm: 4 }, display: "grid", gap: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 2 }}>
          <Strap tab={result ? "Booked" : "Book"} tone={result ? "seller" : "neutral"} title={when} sub="Your time zone" />
          <ButtonBase onClick={close} aria-label="Close" sx={{ ...strapType, fontSize: "0.8125rem", letterSpacing: "0.1em", color: studio.haze, p: 1, "&:hover": { color: "#fff" } }}>
            Close
          </ButtonBase>
        </Box>

        {!result && !role && (
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Typography component="h2" sx={{ ...strapType, fontSize: "2rem" }}>
              Which side?
            </Typography>
            {ROLES.map((r) => (
              <ButtonBase
                key={r.role}
                onClick={() => setRole(r.role)}
                sx={{
                  display: "grid",
                  justifyItems: "start",
                  gap: 1,
                  textAlign: "left",
                  p: 2.5,
                  bgcolor: studio.cobaltDeep,
                  border: `2px solid ${studio.cobaltLine}`,
                  transition: "border-color 160ms, background-color 160ms",
                  "&:hover, &:focus-visible": { borderColor: r.tone === "seller" ? studio.signal : studio.cyan, bgcolor: studio.cobalt },
                }}
              >
                <Strap tab={r.tab} tone={r.tone} title={r.role === "seller" ? "Sell it" : "Say no"} size="sm" />
                <Typography sx={{ color: studio.haze }}>{r.pitch}</Typography>
              </ButtonBase>
            ))}
          </Box>
        )}

        {!result && role && (
          <Box component="form" onSubmit={submit} noValidate sx={{ display: "grid", gap: 2 }}>
            <Typography component="h2" sx={{ ...strapType, fontSize: "2rem" }}>
              Your handle
            </Typography>
            <Typography sx={{ color: studio.haze }}>
              Shown on your name strap as the {role}. 3–20 letters, numbers or underscores.
            </Typography>
            <TextField
              autoFocus
              value={handle}
              onChange={(e) => setHandle(e.target.value.trim())}
              onBlur={() => setTouched(true)}
              placeholder="your_handle"
              error={touched && !handleOk}
              helperText={touched && !handleOk ? "Use 3–20 letters, numbers or underscores." : " "}
              slotProps={{ htmlInput: { "aria-label": "Handle", maxLength: 20, autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
              sx={{ "& .MuiFormHelperText-root": { color: "#ff9aa3", mx: 0 } }}
            />
            {error && (
              <Alert severity="error" variant="filled" sx={{ bgcolor: studio.onAir }}>
                {error}
              </Alert>
            )}
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Button type="submit" variant="contained" disabled={submitting} sx={{ flex: 1 }}>
                {submitting ? "Booking…" : `Book ${role} seat`}
              </Button>
              <Button onClick={() => setRole(null)} sx={{ color: studio.haze }}>
                Back
              </Button>
            </Box>
          </Box>
        )}

        {result && (
          <Box sx={{ display: "grid", gap: 2 }}>
            <Typography component="h2" sx={{ ...strapType, fontSize: "2rem" }}>
              You&apos;re on the rundown
            </Typography>
            <Strap
              tab={result.booking.role === "seller" ? "Seller" : "Buyer"}
              tone={result.booking.role === "seller" ? "seller" : "buyer"}
              title={`@${result.booking.handle}`}
              sub={result.booking.opponentHandle ? `vs @${result.booking.opponentHandle}` : `Waiting for a ${result.booking.role === "seller" ? "buyer" : "seller"}…`}
            />
            <Box>
              <Typography sx={{ ...strapType, fontSize: "0.8125rem", letterSpacing: "0.1em", color: studio.haze, mb: 0.75 }}>Your ticket link</Typography>
              <TextField id="ticket-link" value={link} fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Ticket link", style: { fontSize: "0.9375rem" } } }} />
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Button variant="contained" onClick={copy} sx={{ flex: 1 }}>
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                variant="outlined"
                onClick={() =>
                  downloadIcs(
                    `pitchdrill-${new Intl.DateTimeFormat("en-CA", { timeZone }).format(Date.parse(result.booking.slotId))}-${timeLabel(result.booking.slotId, timeZone).replace(/\W+/g, "")}.ics`,
                    buildIcs({ slotId: result.booking.slotId, role: result.booking.role, link }),
                  )
                }
                sx={{ flex: 1, borderRadius: 0, borderWidth: 2, borderColor: studio.signal, color: studio.signal, "&:hover": { borderWidth: 2, bgcolor: "rgba(255,214,10,0.08)" } }}
              >
                Add to calendar
              </Button>
            </Box>
            <Alert severity="warning" variant="outlined" sx={{ color: "#fff", borderColor: studio.signal, "& .MuiAlert-icon": { color: studio.signal } }}>
              This link is the only way back to your seat. Keep it private: anyone with it can take your place.
            </Alert>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

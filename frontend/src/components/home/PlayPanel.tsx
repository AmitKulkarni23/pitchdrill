"use client";

import { useState, useSyncExternalStore } from "react";
import { Alert, Box, Button, ButtonBase, TextField, Typography } from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { countdown, slotLabel, timeLabel } from "@/lib/slots";
import { addTicket, getHandle, setHandle as saveHandle } from "@/lib/storage";
import { isValidHandle } from "@/lib/validation";
import { hall, panel } from "@/config/tokens";
import type { CreateBookingResponse, Role } from "@/types/api";
import { YourRounds } from "./YourRounds";

const noop = () => () => {};

const ROLES: { role: Role; label: string; pitch: string }[] = [
  { role: "seller", label: "Seller", pitch: "Pitch a product you see 5 minutes before" },
  { role: "buyer", label: "Buyer", pitch: "Play a secret persona and push back" },
];

interface Props {
  slotId: string | null;
  timeZone: string;
  now: number;
}

export function PlayPanel({ slotId, timeZone, now }: Props) {
  const [role, setRole] = useState<Role>("seller");
  // Prefilled with the last handle booked from this browser; typing overrides it.
  const storedHandle = useSyncExternalStore(noop, getHandle, () => null);
  const [typed, setHandle] = useState<string | null>(null);
  const handle = typed ?? storedHandle ?? "";
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateBookingResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOk = isValidHandle(handle);
  const link = result ? `${window.location.origin}/t#${result.ticket}` : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!slotId || !handleOk) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<CreateBookingResponse>("/bookings", { slotId, handle, role });
      addTicket(res.ticket);
      saveHandle(res.booking.handle);
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
      (document.getElementById("ticket-link") as HTMLInputElement | null)?.select();
    }
  }

  function bookAnother() {
    setResult(null);
    setHandle(null);
    setTouched(false);
    setCopied(false);
  }

  return (
    <Box component="section" id="play" aria-labelledby="play-h" sx={{ ...panel, flex: "5 1 340px", minWidth: 0, p: { xs: 2, sm: 2.75 }, display: "grid", gap: 2.25, alignContent: "start", scrollMarginTop: 80 }}>
      <Typography id="play-h" variant="h2">
        Play
      </Typography>

      <YourRounds now={now} timeZone={timeZone} refreshKey={result?.ticket} />

      {!result && (
        <>
          <Box sx={{ bgcolor: hall.greenTint, borderRadius: "12px", p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: hall.greenDeep }}>Your slot</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{slotId ? slotLabel(slotId, now, timeZone) : "None open"}</Typography>
            </Box>
            {slotId && <Typography sx={{ fontSize: 15, fontWeight: 700, color: hall.greenDeep }}>starts in {countdown(Date.parse(slotId) - now)}</Typography>}
          </Box>

          <Box component="form" onSubmit={submit} noValidate sx={{ display: "grid", gap: 2 }}>
            <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
              <Box component="legend" sx={{ fontSize: 14, fontWeight: 700, p: 0, mb: 1 }}>
                Play as
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                {ROLES.map((r) => {
                  const on = r.role === role;
                  return (
                    <ButtonBase
                      key={r.role}
                      aria-pressed={on}
                      onClick={() => setRole(r.role)}
                      sx={{
                        display: "grid",
                        justifyItems: "start",
                        textAlign: "left",
                        gap: 0.25,
                        px: 1.75,
                        py: 1.5,
                        borderRadius: "10px",
                        bgcolor: hall.panel,
                        // Same border box either way so selection doesn't shift layout.
                        boxShadow: `inset 0 0 0 ${on ? 2 : 1}px ${on ? hall.green : hall.field}`,
                        transition: "box-shadow 160ms",
                        "&:hover": { boxShadow: `inset 0 0 0 2px ${on ? hall.green : hall.muted}` },
                      }}
                    >
                      <Box sx={{ fontWeight: 800, fontSize: 15 }}>{r.label}</Box>
                      <Box sx={{ fontSize: 13, color: hall.muted }}>{r.pitch}</Box>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ display: "grid", gap: 0.75 }}>
              <Box component="label" htmlFor="handle" sx={{ fontSize: 14, fontWeight: 700 }}>
                Your handle
              </Box>
              <TextField
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.trim())}
                onBlur={() => setTouched(true)}
                placeholder="e.g. maya_k"
                error={touched && !handleOk}
                helperText={touched && !handleOk ? "Use 3–20 letters, numbers or underscores." : "Shown publicly. 3–20 letters, numbers or underscores."}
                slotProps={{ htmlInput: { maxLength: 20, autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
                sx={{ "& .MuiFormHelperText-root": { mx: 0 } }}
              />
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Alert severity="info" sx={{ fontWeight: 600 }}>Rounds are recorded and replayed publicly.</Alert>

            <Button type="submit" variant="contained" size="large" disabled={!slotId || submitting} sx={{ py: 1.75, fontSize: 16, fontWeight: 800 }}>
              {submitting ? "Booking…" : slotId ? `Book ${timeLabel(slotId, timeZone)} as ${role}` : "No slots open"}
            </Button>
            <Typography variant="body2" sx={{ color: hall.muted, mt: -0.5 }}>
              No account. You get a private ticket link to come back with.
            </Typography>
          </Box>
        </>
      )}

      {result && (
        <Box sx={{ display: "grid", gap: 2 }} aria-live="polite">
          <Box sx={{ bgcolor: hall.greenTint, borderRadius: "12px", p: 2 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>You&apos;re booked</Typography>
            <Typography sx={{ color: hall.greenDeep, fontWeight: 600 }}>
              @{result.booking.handle} as {result.booking.role}, {slotLabel(result.booking.slotId, now, timeZone)}
            </Typography>
            <Typography variant="body2" sx={{ color: hall.muted, mt: 0.5 }}>
              {result.booking.opponentHandle
                ? `Paired with @${result.booking.opponentHandle}.`
                : `Waiting for a ${result.booking.role === "seller" ? "buyer" : "seller"} to book this slot.`}
            </Typography>
          </Box>
          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Box component="label" htmlFor="ticket-link" sx={{ fontSize: 14, fontWeight: 700 }}>
              Your ticket link
            </Box>
            <TextField id="ticket-link" value={link} fullWidth slotProps={{ htmlInput: { readOnly: true, style: { fontSize: 14 } } }} />
          </Box>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() =>
                downloadIcs(
                  `pitchdrill-${new Intl.DateTimeFormat("en-CA", { timeZone }).format(Date.parse(result.booking.slotId))}-${timeLabel(result.booking.slotId, timeZone).replace(/\W+/g, "")}.ics`,
                  buildIcs({ slotId: result.booking.slotId, role: result.booking.role, link }),
                )
              }
              sx={{ py: 1.5, fontWeight: 800 }}
            >
              Add to calendar
            </Button>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 1 }}>
              <Button variant="outlined" onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button variant="outlined" href={link}>
                Open round
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: hall.muted }}>
              The calendar event has your link and a reminder 15 minutes before. This browser also keeps it under Your rounds above. Keep the link private: anyone with it can take your place.
            </Typography>
          </Box>
          <Button onClick={bookAnother} sx={{ justifySelf: "start", px: 0, "&:hover": { bgcolor: "transparent", textDecoration: "underline" } }}>
            Book another seat
          </Button>
        </Box>
      )}
    </Box>
  );
}

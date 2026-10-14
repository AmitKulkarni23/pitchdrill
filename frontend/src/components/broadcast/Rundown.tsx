import { Box, Typography } from "@mui/material";
import { studio, strapType } from "@/config/tokens";

const ROWS = [
  { code: "Up to 7 days", title: "Book a slot", body: "Pick a time, choose seller or buyer, type a handle. You get a private ticket link and a calendar reminder. No signup." },
  { code: "T − 5:00", title: "Arena opens", body: "Open your ticket link, check your camera and mic, and meet your opponent on the split screen." },
  { code: "T − 0:30", title: "Briefs revealed", body: "The seller gets a product they've never seen. The buyer gets a secret persona: budget, doubts, reasons to say no." },
  { code: "T 0:00", title: "On air: 60 seconds", body: "One take. The clock doesn't stop and there are no retakes.", live: true },
  { code: "Buzzer", title: "Audience verdict", body: "Everyone watching votes Sold or Not sold. The tally is live." },
  { code: "After", title: "Replay", body: "The split-screen recording stays up with votes and comments, so you can see what worked." },
];

/** Run of show: the round's timeline as a broadcast rundown sheet. */
export function Rundown() {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, borderTop: `2px solid ${studio.cobaltLine}` }}>
      {ROWS.map((row) => (
        <Box
          component="li"
          key={row.title}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "11rem 18rem 1fr" },
            gap: { xs: 0.75, md: 3 },
            alignItems: "baseline",
            py: { xs: 2.25, md: 2.75 },
            px: { xs: 0, md: 1 },
            borderBottom: `2px solid ${studio.cobaltLine}`,
            bgcolor: row.live ? studio.cobaltNight : "transparent",
          }}
        >
          <Box sx={{ ...strapType, fontSize: "1.375rem", color: row.live ? "#ff5a68" : studio.signal, fontVariantNumeric: "tabular-nums" }}>
            {row.code}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Box component="h3" sx={{ ...strapType, fontSize: "1.625rem", m: 0 }}>
              {row.title}
            </Box>
            {row.live && (
              <Box sx={{ ...strapType, fontSize: "0.6875rem", letterSpacing: "0.12em", bgcolor: studio.onAir, color: "#fff", px: 0.75, py: 0.375 }}>
                No retakes
              </Box>
            )}
          </Box>
          <Typography sx={{ color: studio.haze, maxWidth: "62ch" }}>{row.body}</Typography>
        </Box>
      ))}
    </Box>
  );
}

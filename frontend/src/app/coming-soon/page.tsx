import type { Metadata } from "next";
import { Box, Typography } from "@mui/material";
import { hall, panel } from "@/config/tokens";

export const metadata: Metadata = { title: "Coming soon — PitchDrill" };

// Shown by proxy.ts to visitors outside the US.
export default function ComingSoon() {
  return (
    <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2 }}>
      <Box sx={{ ...panel, maxWidth: 480, p: { xs: 3, sm: 4 }, textAlign: "center", display: "grid", gap: 1 }}>
        <Box sx={{ fontWeight: 800, fontSize: 19, color: hall.green }}>PitchDrill</Box>
        <Typography variant="h1" sx={{ textWrap: "balance" }}>Coming soon to your country</Typography>
        <Typography sx={{ color: hall.muted }}>PitchDrill is open in the United States for now. We&apos;re working on bringing it to more places.</Typography>
      </Box>
    </Box>
  );
}

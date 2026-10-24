"use client";

import { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { reportError } from "@/lib/rum";
import { hall, panel } from "@/config/tokens";

// A page crashed while rendering: report it to RUM (React catches it, so it never reaches window.onerror).
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <Box component="main" sx={{ minHeight: "60dvh", display: "grid", placeItems: "center", px: 2 }}>
      <Box sx={{ ...panel, maxWidth: 480, p: { xs: 3, sm: 4 }, textAlign: "center", display: "grid", gap: 1.5 }}>
        <Typography variant="h1">Something went wrong</Typography>
        <Typography sx={{ color: hall.muted }}>This page hit an error. Try again, or head back home.</Typography>
        <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
          <Button variant="contained" onClick={reset}>Try again</Button>
          <Button href="/">Home</Button>
        </Box>
      </Box>
    </Box>
  );
}

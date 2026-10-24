import type { Metadata } from "next";
import { Box, Typography } from "@mui/material";
import { ContactForm } from "@/components/ContactForm";
import { SiteHeader } from "@/components/home/SiteHeader";
import { hall } from "@/config/tokens";

export const metadata: Metadata = { title: "Contact us — PitchDrill" };

export default function Contact() {
  return (
    <>
      <SiteHeader />
      <Box component="main" sx={{ maxWidth: 640, mx: "auto", px: { xs: 2, sm: 3 }, pt: { xs: 3, sm: 4 }, pb: 8, display: "grid", gap: 3 }}>
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography variant="h1">Contact us</Typography>
          <Typography sx={{ color: hall.muted }}>Questions, feedback or a round that went wrong? Send us a note.</Typography>
        </Box>
        <ContactForm />
      </Box>
    </>
  );
}

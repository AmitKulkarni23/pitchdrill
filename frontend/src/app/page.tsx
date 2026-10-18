import { Box, Typography } from "@mui/material";
import { HomeBoard } from "@/components/home/HomeBoard";
import { HowItWorks } from "@/components/home/HowItWorks";
import { SiteHeader } from "@/components/home/SiteHeader";
import { hall } from "@/config/tokens";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <Box component="main" sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3 }, pt: { xs: 3, sm: 4 }, pb: 8, display: "grid", gap: { xs: 4, sm: 5 } }}>
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography variant="h1" sx={{ textWrap: "balance" }}>
            Learn to sell in two minutes.
          </Typography>
          <Typography sx={{ color: hall.muted, fontSize: { xs: 15, sm: 17 } }}>Watch real two-minute rounds, then play one yourself. No signup.</Typography>
        </Box>
        <HomeBoard howItWorks={<HowItWorks />} />
      </Box>
    </>
  );
}

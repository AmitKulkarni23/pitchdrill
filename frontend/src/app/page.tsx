import { Box, Button, Typography } from "@mui/material";
import { ExampleRound } from "@/components/broadcast/ExampleRound";
import { ProgramGuide } from "@/components/broadcast/ProgramGuide";
import { Rundown } from "@/components/broadcast/Rundown";
import { TopBar } from "@/components/broadcast/TopBar";
import { studio, strapType } from "@/config/tokens";

const section = { px: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1360, mx: "auto" } as const;

export default function Home() {
  return (
    <>
      <TopBar />
      <Box component="main">
        <Box
          component="section"
          sx={{
            ...section,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 11fr) minmax(0, 9fr)" },
            gap: { xs: 5, md: 6 },
            alignItems: "center",
            pt: { xs: 5, md: 9 },
            pb: { xs: 7, md: 11 },
          }}
        >
          <Box sx={{ display: "grid", gap: 3 }}>
            <Typography variant="h1" sx={{ textWrap: "balance" }}>
              Sixty seconds to{" "}
              <Box component="span" sx={{ bgcolor: studio.signal, color: studio.ink, px: "0.12em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                sell it.
              </Box>
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.125rem", md: "1.3125rem" }, color: studio.haze, maxWidth: "36ch", textWrap: "pretty" }}>
              Book a slot and get paired with a stranger. Sell a product you&apos;ve never seen, or play the buyer who won&apos;t budge, while the audience votes Sold or Not sold.
            </Typography>
            <Box sx={{ display: "flex", gap: 2.5, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="contained" size="large" href="#guide" sx={{ fontSize: "1.25rem", px: 4 }}>
                Book a slot
              </Button>
              <Box component="a" href="#rundown" sx={{ ...strapType, fontSize: "1rem", letterSpacing: "0.06em", color: "#fff", textDecoration: "underline" }}>
                How a round runs
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: studio.hazeDim }}>
              No signup. A handle and a ticket link are all you need.
            </Typography>
          </Box>
          <ExampleRound />
        </Box>

        <Box component="section" id="rundown" aria-labelledby="rundown-title" sx={{ bgcolor: studio.cobaltDeep, py: { xs: 7, md: 10 }, scrollMarginTop: 56 }}>
          <Box sx={section}>
            <Typography id="rundown-title" variant="h2" sx={{ mb: { xs: 3, md: 4 } }}>
              How a round runs
            </Typography>
            <Rundown />
          </Box>
        </Box>

        <Box component="section" id="guide" aria-labelledby="guide-title" sx={{ ...section, py: { xs: 7, md: 10 }, scrollMarginTop: 56 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 2, flexWrap: "wrap", mb: { xs: 3, md: 4 } }}>
            <Typography id="guide-title" variant="h2">
              Program guide
            </Typography>
            <Typography sx={{ color: studio.haze, maxWidth: "44ch" }}>
              Every 15 minutes, 4:00 to 8:45 PM Pacific. Pick a time, then pick a side.
            </Typography>
          </Box>
          <ProgramGuide />
        </Box>
      </Box>

      <Box component="footer" sx={{ bgcolor: studio.cobaltNight, borderTop: `2px solid ${studio.cobaltLine}` }}>
        <Box sx={{ ...section, py: 4, display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Box sx={{ ...strapType, fontWeight: 900, fontSize: "1.25rem" }}>
            <Box component="span" sx={{ color: studio.signal }}>Pitch</Box>Drill
          </Box>
          <Typography variant="body2" sx={{ color: studio.haze }}>
            Practice selling in public, one minute at a time.
          </Typography>
        </Box>
      </Box>
    </>
  );
}

import { Box, Typography } from "@mui/material";
import { hall, panel } from "@/config/tokens";

const STEPS = [
  { title: "Book a seat", body: "Pick a slot, choose seller or buyer, type a handle. You're paired with the next person on the other side." },
  { title: "Read your brief", body: "5 minutes before: the seller sees the product, the buyer sees a secret persona." },
  { title: "Two minutes", body: "Split screen, live audience. The seller tries to close, the buyer tries to say no." },
  { title: "The verdict", body: "Watchers vote Sold or Not sold and comment. The replay stays up to learn from." },
];

export function HowItWorks() {
  return (
    <Box component="section" id="how" aria-labelledby="how-h" sx={{ minWidth: 0, display: "grid", gap: 1.75, scrollMarginTop: 80 }}>
      <Typography id="how-h" variant="h2">
        How a round runs
      </Typography>
      {/* Four steps side by side on wide screens, two by two on tablets, stacked on phones. */}
      <Box component="ol" sx={{ ...panel, m: 0, p: 0, listStyle: "none", overflow: "hidden", display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: "1px", bgcolor: hall.lineSoft }}>
        {STEPS.map((s, i) => (
          <Box component="li" key={s.title} sx={{ display: "flex", gap: 1.75, px: 2.25, py: 2, bgcolor: hall.panel }}>
            <Box aria-hidden sx={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", bgcolor: hall.greenTint, color: hall.greenDeep, fontWeight: 800, fontSize: 15, display: "grid", placeItems: "center" }}>
              {i + 1}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{s.title}</Typography>
              <Typography sx={{ color: hall.muted, fontSize: 16, mt: 0.25 }}>
                {s.body}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

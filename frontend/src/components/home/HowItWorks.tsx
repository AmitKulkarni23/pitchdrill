import { Box, Typography } from "@mui/material";
import { hall, panel } from "@/config/tokens";

const STEPS = [
  { title: "Book a seat", body: "Pick a slot, choose seller or buyer, type a handle. You're paired with the next person on the other side." },
  { title: "Read your brief", body: "30 seconds before: the seller sees the product, the buyer sees a secret persona." },
  { title: "Sixty seconds", body: "Split screen, live audience. The seller tries to close, the buyer tries to say no." },
  { title: "The verdict", body: "Watchers vote Sold or Not sold and comment. The replay stays up to learn from." },
];

export function HowItWorks() {
  return (
    <Box component="section" id="how" aria-labelledby="how-h" sx={{ flex: "5 1 340px", minWidth: 0, display: "grid", gap: 1.75, alignContent: "start", scrollMarginTop: 80 }}>
      <Typography id="how-h" variant="h2">
        How a round runs
      </Typography>
      <Box component="ol" sx={{ ...panel, m: 0, p: 0, listStyle: "none", overflow: "hidden" }}>
        {STEPS.map((s, i) => (
          <Box component="li" key={s.title} sx={{ display: "flex", gap: 1.75, px: 2.25, py: 2, borderTop: i ? `1px solid ${hall.lineSoft}` : 0 }}>
            <Box aria-hidden sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", bgcolor: hall.greenTint, color: hall.greenDeep, fontWeight: 800, fontSize: 14, display: "grid", placeItems: "center" }}>
              {i + 1}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{s.title}</Typography>
              <Typography variant="body2" sx={{ color: hall.muted }}>
                {s.body}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

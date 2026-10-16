import { Box, Button } from "@mui/material";
import { hall } from "@/config/tokens";

const LINKS = [
  { href: "/#archive", label: "Past rounds" },
  { href: "/#how", label: "How it works" },
];

export function SiteHeader() {
  return (
    <Box component="header" sx={{ bgcolor: hall.panel, borderBottom: `1px solid ${hall.line}`, position: "sticky", top: 0, zIndex: 10 }}>
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3 }, py: 1.5, display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 3 } }}>
        <Box component="a" href="/" sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", color: hall.ink }}>
          <Box aria-hidden sx={{ width: 30, height: 30, borderRadius: "8px", bgcolor: hall.green, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>
            60
          </Box>
          <Box sx={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.01em" }}>PitchDrill</Box>
        </Box>
        <Box component="nav" aria-label="Main" sx={{ display: { xs: "none", sm: "flex" }, gap: 0.5, flexGrow: 1 }}>
          {LINKS.map((l) => (
            <Box
              key={l.href}
              component="a"
              href={l.href}
              sx={{ px: 1.75, py: 1.25, borderRadius: "8px", textDecoration: "none", color: hall.muted, fontWeight: 600, fontSize: 15, "&:hover": { color: hall.ink, bgcolor: hall.chip } }}
            >
              {l.label}
            </Box>
          ))}
        </Box>
        <Button variant="contained" href="/#play" sx={{ ml: "auto" }}>
          Book a seat
        </Button>
      </Box>
    </Box>
  );
}

"use client";

import { Box } from "@mui/material";
import { useNow } from "@/hooks/useClock";
import { studio, strapType, fonts } from "@/config/tokens";
import { ROUND_SECONDS } from "@/lib/slots";
import { OnAirClock } from "./OnAirClock";
import { Strap } from "./Strap";

// Illustration only: handles, product and tally are made up and labelled "Example round".
const EXAMPLE = {
  seller: "maya_sells",
  buyer: "skeptic_dev",
  product: "The Forever Umbrella",
  tagline: "Lifetime guarantee. Folds to the size of a phone.",
  price: "$49",
  sold: 61,
};
const AFTER_BUZZER_SECONDS = 9;
const CYCLE = ROUND_SECONDS + AFTER_BUZZER_SECONDS;

const scanlines = "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px)";

function Camera({ cam, monogram, tone }: { cam: string; monogram: string; tone: string }) {
  return (
    <Box sx={{ position: "relative", bgcolor: tone, backgroundImage: scanlines, overflow: "hidden" }}>
      <Box sx={{ position: "absolute", top: 10, left: 12, ...strapType, fontSize: "0.6875rem", letterSpacing: "0.14em", color: studio.hazeDim }}>
        {cam}
      </Box>
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          ...strapType,
          fontWeight: 900,
          fontSize: "clamp(5rem, 13vw, 9rem)",
          color: studio.cobaltLine,
        }}
      >
        {monogram}
      </Box>
    </Box>
  );
}

export function ExampleRound() {
  const now = useNow();
  const t = now === null ? 13 : Math.floor(now / 1000) % CYCLE;
  const live = t < ROUND_SECONDS;
  const remaining = live ? ROUND_SECONDS - t : 0;

  return (
    <Box component="figure" sx={{ m: 0 }} aria-label="Example round: a seller and a buyer on a split screen with a 60-second clock">
      <Box component="figcaption" sx={{ ...strapType, fontSize: "0.75rem", letterSpacing: "0.14em", color: studio.haze, mb: 1 }}>
        Example round · illustration
      </Box>

      <Box sx={{ position: "relative", border: `2px solid ${studio.cobaltLine}`, bgcolor: studio.cobaltNight }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", aspectRatio: "16 / 9", bgcolor: studio.cobaltLine }}>
          <Camera cam="CAM 1" monogram="M" tone={studio.cobaltDeep} />
          <Camera cam="CAM 2" monogram="S" tone="#0a145f" />
        </Box>

        <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)" }}>
          <OnAirClock seconds={remaining} live={live} />
        </Box>

        <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", px: 1.5, gap: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <Strap tab="Seller" tone="seller" title={`@${EXAMPLE.seller}`} size="sm" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Strap tab="Buyer" tone="buyer" title={`@${EXAMPLE.buyer}`} size="sm" />
          </Box>
        </Box>

        {/* Verdict wipes in at the buzzer. */}
        <Box
          aria-hidden={live}
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            alignContent: "center",
            gap: 1.25,
            px: { xs: 2, sm: 4 },
            bgcolor: "rgba(8,16,79,0.92)",
            clipPath: live ? "inset(0 100% 0 0)" : "inset(0 0 0 0)",
            transition: "clip-path 520ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <Box sx={{ ...strapType, fontSize: "clamp(1.75rem, 4vw, 2.75rem)", color: studio.signal }}>Buzzer. Audience verdict:</Box>
          {[
            { label: "Sold", value: EXAMPLE.sold, color: studio.signal },
            { label: "Not sold", value: 100 - EXAMPLE.sold, color: studio.plate },
          ].map((row) => (
            <Box key={row.label} sx={{ display: "grid", gridTemplateColumns: "7.5rem 1fr 3.5rem", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ ...strapType, fontSize: "1.125rem" }}>{row.label}</Box>
              <Box sx={{ height: 18, bgcolor: studio.cobaltDeep }}>
                <Box
                  sx={{
                    height: "100%",
                    bgcolor: row.color,
                    width: live ? "0%" : `${row.value}%`,
                    transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1) 300ms",
                  }}
                />
              </Box>
              <Box sx={{ ...strapType, fontSize: "1.125rem", textAlign: "right" }}>{row.value}%</Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "stretch", mt: "-2px", position: "relative" }}>
        <Box
          sx={{
            ...strapType,
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            bgcolor: studio.onAir,
            color: "#fff",
            px: 1.25,
            display: "flex",
            alignItems: "center",
            writingMode: { xs: "horizontal-tb", sm: "vertical-rl" },
            transform: { sm: "rotate(180deg)" },
          }}
        >
          Product
        </Box>
        <Box sx={{ flex: 1, bgcolor: studio.plate, color: studio.ink, px: 2, py: 1.25, minWidth: 0 }}>
          <Box sx={{ ...strapType, fontSize: "clamp(1.25rem, 2.6vw, 1.75rem)" }}>{EXAMPLE.product}</Box>
          <Box sx={{ fontFamily: fonts.body, fontSize: "0.875rem", fontWeight: 600, color: "#2a3380", mt: 0.5 }}>{EXAMPLE.tagline}</Box>
        </Box>
        <Box
          sx={{
            ...strapType,
            fontWeight: 900,
            fontSize: "clamp(2rem, 4.4vw, 3rem)",
            bgcolor: studio.signal,
            color: studio.ink,
            px: 2,
            display: "flex",
            alignItems: "center",
            transform: "rotate(-4deg) translateY(-6px)",
            boxShadow: "0 10px 24px rgba(8,16,79,0.45)",
          }}
        >
          {EXAMPLE.price}
        </Box>
      </Box>
    </Box>
  );
}

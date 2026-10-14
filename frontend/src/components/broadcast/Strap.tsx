import { Box } from "@mui/material";
import { studio, strapType, fonts } from "@/config/theme";

const TAB_COLORS = {
  seller: { bg: studio.signal, fg: studio.ink },
  buyer: { bg: studio.cyan, fg: studio.ink },
  live: { bg: studio.onAir, fg: "#ffffff" },
  neutral: { bg: studio.plate, fg: studio.ink },
} as const;

export type StrapTone = keyof typeof TAB_COLORS;

interface Props {
  tab: string;
  tone?: StrapTone;
  title: string;
  sub?: string;
  size?: "sm" | "md";
}

/** Lower-third name strap: a colored role tab with a slanted lead edge, then the name plate. */
export function Strap({ tab, tone = "neutral", title, sub, size = "md" }: Props) {
  const c = TAB_COLORS[tone];
  const sm = size === "sm";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "stretch", maxWidth: "100%" }}>
      <Box
        sx={{
          ...strapType,
          bgcolor: c.bg,
          color: c.fg,
          fontSize: sm ? "0.75rem" : "0.875rem",
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          pl: sm ? 1 : 1.5,
          pr: sm ? 2 : 2.5,
          clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
          mr: "-10px",
          zIndex: 1,
        }}
      >
        {tab}
      </Box>
      <Box sx={{ bgcolor: studio.plate, color: studio.ink, pl: sm ? 2 : 2.5, pr: sm ? 1.5 : 2, py: sm ? 0.5 : 0.75, minWidth: 0 }}>
        <Box sx={{ ...strapType, fontSize: sm ? "1rem" : "1.375rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </Box>
        {sub && (
          <Box sx={{ fontFamily: fonts.body, fontSize: sm ? "0.6875rem" : "0.8125rem", fontWeight: 600, color: "#2a3380", mt: 0.25 }}>
            {sub}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Design tokens. Plain module (no "use client") so server components can import them.

// Study Hall palette: a calm light ground, white panels, one green for actions and "Sold".
// Live is red text plus a dot, never color alone.
export const hall = {
  ground: "#F7F7F5",
  panel: "#FFFFFF",
  line: "#E6E8EB",
  lineSoft: "#EEF0F2",
  field: "#D5D9DE",
  chip: "#EEF0EE",
  ink: "#1C1F24",
  muted: "#5B6270",
  green: "#2F6E50",
  greenDeep: "#1F5A3F",
  greenTint: "#E7F1EC",
  sand: "#F1EDE4",
  sandInk: "#5E4511",
  seller: "#DCE4EE",
  sellerInk: "#34506F",
  buyer: "#EFE6D2",
  buyerInk: "#6B4E12",
  live: "#B42318",
} as const;

export const font = "var(--font-manrope), system-ui, sans-serif";

export const panel = {
  bgcolor: hall.panel,
  border: `1px solid ${hall.line}`,
  borderRadius: "16px",
} as const;

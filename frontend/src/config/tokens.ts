// Design tokens. Plain module (no "use client") so server components can import them.

// Broadcast palette. Studio cobalt owns the field; yellow is the action and the price;
// red is reserved for LIVE and the last ten seconds (DESIGN.md: The On-Air Rule).
export const studio = {
  cobalt: "#1b2fc4",
  cobaltDeep: "#0d1873",
  cobaltNight: "#08104f",
  cobaltLine: "#3a4fe0",
  signal: "#ffd60a",
  signalDeep: "#e0b800",
  cyan: "#3de0ff",
  onAir: "#e5162b",
  plate: "#f5f7ff",
  ink: "#0a1050",
  haze: "#c9d0ff",
  hazeDim: "#9aa6f5",
} as const;

export const fonts = {
  display: "var(--font-archivo), 'Arial Narrow', sans-serif",
  body: "var(--font-public-sans), system-ui, sans-serif",
} as const;

// Condensed heavy caps for straps, clocks and headlines (Archivo width axis).
export const strapType = {
  fontFamily: fonts.display,
  fontStretch: "70%",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.01em",
  lineHeight: 1,
} as const;

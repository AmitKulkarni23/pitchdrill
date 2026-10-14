"use client";

import { createTheme } from "@mui/material/styles";

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

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: studio.signal, contrastText: studio.ink },
    secondary: { main: studio.cyan, contrastText: studio.ink },
    error: { main: studio.onAir },
    background: { default: studio.cobalt, paper: studio.cobaltDeep },
    text: { primary: "#ffffff", secondary: studio.haze },
    divider: studio.cobaltLine,
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: fonts.body,
    h1: { ...strapType, fontSize: "clamp(3.25rem, 8.5vw, 6rem)", fontWeight: 900, lineHeight: 0.9 },
    h2: { ...strapType, fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: 0.95 },
    h3: { ...strapType, fontSize: "1.5rem" },
    button: { ...strapType, fontSize: "1.125rem", letterSpacing: "0.03em" },
    body1: { fontSize: "1.0625rem", lineHeight: 1.55 },
    body2: { fontSize: "0.9375rem", lineHeight: 1.5 },
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: "14px 26px 12px",
          transition: "background-color 160ms cubic-bezier(0.16, 1, 0.3, 1), transform 160ms cubic-bezier(0.16, 1, 0.3, 1)",
          "&:active": { transform: "translateY(1px)" },
          variants: [
            {
              props: { variant: "contained", color: "primary" },
              style: {
                backgroundColor: studio.signal,
                color: studio.ink,
                boxShadow: "none",
                "&:hover": { backgroundColor: "#ffe14d", boxShadow: "none" },
              },
            },
          ],
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: studio.plate,
          color: studio.ink,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: studio.signal },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: studio.signal, borderWidth: 3 },
        },
        input: { fontFamily: fonts.display, fontWeight: 700, fontSize: "1.375rem", padding: "14px 16px" },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 0 } } },
  },
});

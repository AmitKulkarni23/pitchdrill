"use client";

import { createTheme } from "@mui/material/styles";
import { font, hall } from "./tokens";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: hall.green, dark: hall.greenDeep, contrastText: "#fff" },
    error: { main: hall.live },
    background: { default: hall.ground, paper: hall.panel },
    text: { primary: hall.ink, secondary: hall.muted },
    divider: hall.line,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: font,
    h1: { fontSize: "clamp(1.625rem, 4vw, 2.125rem)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 },
    h2: { fontSize: "1.375rem", fontWeight: 800, lineHeight: 1.25 },
    button: { textTransform: "none", fontWeight: 700, fontSize: "0.9375rem" },
    body1: { fontSize: "1.0625rem", lineHeight: 1.55 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: "11px 18px",
          transition: "background-color 160ms cubic-bezier(0.16, 1, 0.3, 1), border-color 160ms",
          "&:active": { transform: "translateY(1px)" },
        },
        outlined: { borderColor: hall.field, color: hall.ink, "&:hover": { borderColor: hall.ink, backgroundColor: hall.panel } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: hall.panel,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: hall.field },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: hall.muted },
        },
        input: { padding: "12px 14px", fontSize: "1rem" },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
  },
});

"use client";

import { createTheme } from "@mui/material/styles";
import { fonts, strapType, studio } from "./tokens";

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

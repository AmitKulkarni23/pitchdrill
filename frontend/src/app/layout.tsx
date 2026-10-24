import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Telemetry } from "@/components/Telemetry";
import { theme } from "@/config/theme";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PitchDrill — learn to sell in two minutes",
  description: "Watch real two-minute sales rounds, then play one yourself as the seller or the buyer. No signup.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
        <Telemetry />
      </body>
    </html>
  );
}

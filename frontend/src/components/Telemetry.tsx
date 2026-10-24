"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { initRum } from "@/lib/rum";

/** Vercel Analytics (page views) and CloudWatch RUM (browser errors). Fragments are dropped: ticket links carry the ticket there. */
export function Telemetry() {
  useEffect(() => void initRum(), []);
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split("#")[0]! })} />;
}

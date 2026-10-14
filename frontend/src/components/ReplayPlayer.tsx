"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { studio } from "@/config/tokens";

/** HLS replay: native where the browser supports it (Safari), hls.js elsewhere (imported on demand). */
export function ReplayPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroy: (() => void) | undefined;
    let cancelled = false;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setError("This browser can't play the replay.");
            return;
          }
          const hls = new Hls();
          hls.on(Hls.Events.ERROR, (_e, data) => data.fatal && setError("The replay couldn't be loaded. Try again in a moment."));
          hls.loadSource(src);
          hls.attachMedia(video);
          destroy = () => hls.destroy();
        })
        .catch(() => !cancelled && setError("The replay couldn't be loaded."));
    }
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src]);

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box component="video" ref={ref} controls playsInline sx={{ width: "100%", aspectRatio: "16 / 9", bgcolor: studio.cobaltNight, border: `2px solid ${studio.cobaltLine}` }} />
    </Box>
  );
}

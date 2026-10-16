"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";

/** HLS replay from CloudFront. Safari plays HLS natively; everyone else gets hls.js. */
export function ReplayVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    let destroy = () => {};
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return;
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      destroy = () => hls.destroy();
    });
    return () => destroy();
  }, [src]);
  return <Box component="video" ref={ref} controls playsInline data-testid="replay" sx={{ width: "100%", borderRadius: "12px", bgcolor: "#000", aspectRatio: "16 / 9" }} />;
}

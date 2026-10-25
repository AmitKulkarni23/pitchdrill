"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { nameTag, Side } from "@/components/home/LiveTile";
import { hall } from "@/config/tokens";
import type { PublicRound } from "@/types/api";

/** backend/src/lib/voices.ts STEP_MS: one level digit per 100 ms of replay. */
const STEP_MS = 100;

/**
 * Replay of a round. Rounds are audio only, so the recording's picture (IVS "camera off" icons) is never shown: the
 * players' initials stand in, with a speaking meter per side from `voiceLevels`, under the HLS audio from CloudFront.
 * Safari plays HLS natively; everyone else gets hls.js.
 */
export function ReplayVideo({ src, round }: { src: string; round: PublicRound }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    if (media.canPlayType("application/vnd.apple.mpegurl")) {
      media.src = src;
      return;
    }
    let destroy = () => {};
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return;
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(media);
      destroy = () => hls.destroy();
    });
    return () => destroy();
  }, [src]);
  const levels = round.voiceLevels;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "12px", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", bgcolor: "#fff" }}>
        <Side handle={round.sellerHandle} bg={hall.seller} ink={hall.sellerInk}>
          {levels?.seller && <VoiceMeter levels={levels.seller} media={ref} />}
        </Side>
        <Side handle={round.buyerHandle} bg={hall.buyer} ink={hall.buyerInk}>
          {levels?.buyer && <VoiceMeter levels={levels.buyer} media={ref} />}
        </Side>
        <Box sx={{ ...nameTag, left: 10 }}>Seller @{round.sellerHandle}</Box>
        <Box sx={{ ...nameTag, right: 10 }}>Buyer @{round.buyerHandle}</Box>
      </Box>
      <Box component="audio" ref={ref} controls data-testid="replay" sx={{ width: "100%" }} />
    </Box>
  );
}

/** The live round's level bar, replayed: follows the audio's playback position, drawn without re-rendering React. */
function VoiceMeter({ levels, media }: { levels: string; media: React.RefObject<HTMLAudioElement | null> }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const m = media.current;
      const digit = m && !m.paused ? Number(levels[Math.floor((m.currentTime * 1000) / STEP_MS)] ?? 0) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${digit / 9})`;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [levels, media]);
  return (
    <Box aria-hidden sx={{ position: "absolute", left: 16, right: 16, top: "68%", height: 8, borderRadius: 999, bgcolor: "rgba(255,255,255,0.7)", overflow: "hidden" }}>
      <Box ref={bar} sx={{ height: "100%", bgcolor: hall.green, transformOrigin: "left", transform: "scaleX(0)", transition: "transform 80ms linear" }} />
    </Box>
  );
}

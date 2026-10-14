"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { Strap } from "@/components/broadcast/Strap";
import { studio } from "@/config/tokens";
import { sideForRole } from "@/lib/arena";
import type { Role } from "@/types/api";

export interface Tile {
  role: Role;
  handle: string;
  stream: MediaStream | null;
  /** Your own preview is muted so you do not hear yourself. */
  muted?: boolean;
}

function Video({ stream, muted }: { stream: MediaStream | null; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <Box component="video" ref={ref} autoPlay playsInline muted={muted} sx={{ width: "100%", height: "100%", objectFit: "cover", bgcolor: studio.cobaltNight }} />;
}

/** Seller left, buyer right; stacks on narrow screens. Shared with the spectator view. */
export function SplitScreen({ tiles }: { tiles: Tile[] }) {
  const ordered = (["left", "right"] as const).map((side) => tiles.find((t) => sideForRole(t.role) === side));
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: "2px", bgcolor: studio.cobaltLine, border: `2px solid ${studio.cobaltLine}` }}>
      {ordered.map((tile, i) => (
        <Box key={i} sx={{ position: "relative", aspectRatio: "16 / 9", bgcolor: studio.cobaltNight, display: "grid", placeItems: "center" }}>
          {tile ? <Video stream={tile.stream} muted={tile.muted} /> : <Box sx={{ color: studio.hazeDim }}>Waiting for {i === 0 ? "seller" : "buyer"}…</Box>}
          {tile && (
            <Box sx={{ position: "absolute", left: 8, bottom: 8 }}>
              <Strap size="sm" tab={tile.role} tone={tile.role} title={`@${tile.handle}`} />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

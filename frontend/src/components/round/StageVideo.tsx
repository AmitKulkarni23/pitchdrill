"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { hall } from "@/config/tokens";
import type { Role } from "@/types/api";

type Side = { stream: MediaStream | null; handle?: string };

/**
 * Seller left, buyer right, over IVS Real-Time. `publish` turns on this browser's camera and mic
 * (participant token); spectators pass a SUBSCRIBE-only token.
 */
export function StageVideo({ token, publish, sellerHandle, buyerHandle, onState }: { token: string; publish: boolean; sellerHandle: string; buyerHandle: string; onState?: (state: string) => void }) {
  const [sides, setSides] = useState<Record<Role, Side>>({ seller: { stream: null }, buyer: { stream: null } });
  const [error, setError] = useState<string | null>(null);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  });

  useEffect(() => {
    let cancelled = false;
    let leave = () => {};
    (async () => {
      // The SDK touches window at import time, so it loads only in the browser.
      const { Stage, StageEvents, SubscribeType, LocalStageStream } = await import("amazon-ivs-web-broadcast");
      let local: MediaStream | null = null;
      if (publish) {
        try {
          local = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
        } catch {
          setError("Allow camera and microphone access to play your round, then reload the page.");
          return;
        }
      }
      if (cancelled) return local?.getTracks().forEach((t) => t.stop());
      const localStreams = local ? local.getTracks().map((t) => new LocalStageStream(t)) : [];
      const stage = new Stage(token, {
        stageStreamsToPublish: () => localStreams,
        shouldPublishParticipant: () => publish,
        shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO,
      });
      const tracks = new Map<string, MediaStreamTrack[]>();
      const show = (participant: { id: string; isLocal: boolean; attributes: Record<string, unknown> }) => {
        const role = participant.attributes.role as Role | undefined;
        if (role !== "seller" && role !== "buyer") return;
        const list = tracks.get(participant.id) ?? [];
        // Local audio is never played back to yourself.
        const playable = participant.isLocal ? list.filter((t) => t.kind === "video") : list;
        setSides((s) => ({ ...s, [role]: { stream: playable.length ? new MediaStream(playable) : null, handle: participant.attributes.handle as string } }));
      };
      stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, (participant, streams) => {
        tracks.set(participant.id, [...(tracks.get(participant.id) ?? []), ...streams.map((s) => s.mediaStreamTrack)]);
        show(participant);
      });
      stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant, streams) => {
        const gone = new Set(streams.map((s) => s.mediaStreamTrack.id));
        tracks.set(participant.id, (tracks.get(participant.id) ?? []).filter((t) => !gone.has(t.id)));
        show(participant);
      });
      stage.on(StageEvents.STAGE_PARTICIPANT_LEFT, (participant) => {
        tracks.delete(participant.id);
        show(participant);
      });
      stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (state) => onStateRef.current?.(state));
      leave = () => {
        stage.leave();
        local?.getTracks().forEach((t) => t.stop());
      };
      try {
        await stage.join();
      } catch {
        setError("Couldn't connect to the round's video. Reload to try again.");
      }
      if (cancelled) leave();
    })();
    return () => {
      cancelled = true;
      leave();
    };
  }, [token, publish]);

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: "2px", borderRadius: "12px", overflow: "hidden", bgcolor: "#fff" }}>
        <Pane side={sides.seller} label={`Seller @${sellerHandle}`} bg={hall.seller} />
        <Pane side={sides.buyer} label={`Buyer @${buyerHandle}`} bg={hall.buyer} />
      </Box>
    </Box>
  );
}

function Pane({ side, label, bg }: { side: Side; label: string; bg: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = side.stream;
  }, [side.stream]);
  return (
    <Box sx={{ position: "relative", aspectRatio: "4 / 3", bgcolor: bg, display: "grid", placeItems: "center" }}>
      {side.stream ? (
        <Box component="video" ref={ref} autoPlay playsInline data-testid={`video-${label.split(" ")[0]!.toLowerCase()}`} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Box sx={{ fontSize: 14, fontWeight: 700, color: hall.muted }}>Waiting for camera…</Box>
      )}
      <Box sx={{ position: "absolute", bottom: 10, left: 10, px: 1, py: 0.5, borderRadius: "6px", bgcolor: "rgba(255,255,255,0.94)", fontSize: 12, fontWeight: 600 }}>{label}</Box>
    </Box>
  );
}

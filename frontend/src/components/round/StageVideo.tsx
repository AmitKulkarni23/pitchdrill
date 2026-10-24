"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button } from "@mui/material";
import { hall } from "@/config/tokens";
import { reportError } from "@/lib/rum";
import type { Role } from "@/types/api";

/** `joined`: publishing anything. `video`: an unmuted camera track (mic-only players have none). `audio`: drives the level meter. */
type Side = { stream: MediaStream | null; handle?: string; joined: boolean; video: boolean; audio: MediaStreamTrack | null };
const EMPTY: Side = { stream: null, joined: false, video: false, audio: null };

/**
 * Seller left, buyer right, over IVS Real-Time. `publish` turns on this browser's mic, plus the camera
 * when `camera` is set (participant token); spectators pass a SUBSCRIBE-only token.
 */
export function StageVideo({ token, publish, camera = true, sellerHandle, buyerHandle, onState }: { token: string; publish: boolean; camera?: boolean; sellerHandle: string; buyerHandle: string; onState?: (state: string) => void }) {
  const [sides, setSides] = useState<Record<Role, Side>>({ seller: EMPTY, buyer: EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set once this browser publishes a camera: null = no camera to toggle.
  const [cameraOn, setCameraOn] = useState<boolean | null>(null);
  const toggleCamera = useRef<(on: boolean) => void>(() => {});
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
        const video = { width: 1280, height: 720 };
        local = await navigator.mediaDevices.getUserMedia({ video: camera && video, audio: true }).catch(() => null);
        // Camera blocked or missing: the round still works on mic alone.
        if (!local && camera) {
          local = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          if (local) setNotice("Couldn't turn on your camera, so you're in on mic only.");
        }
        if (!local) {
          reportError(new Error("Microphone unavailable"));
          setError("Allow microphone access to play your round, then reload the page.");
          return;
        }
      }
      if (cancelled) return local?.getTracks().forEach((t) => t.stop());
      const localStreams = local ? local.getTracks().map((t) => new LocalStageStream(t)) : [];
      const localVideo = localStreams.find((s) => s.mediaStreamTrack.kind === "video");
      const stage = new Stage(token, {
        stageStreamsToPublish: () => localStreams,
        shouldPublishParticipant: () => publish,
        shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO,
      });
      type Participant = { id: string; isLocal: boolean; attributes: Record<string, unknown> };
      const tracks = new Map<string, { mediaStreamTrack: MediaStreamTrack; isMuted: boolean }[]>();
      let me: Participant | null = null;
      const show = (participant: Participant) => {
        const role = participant.attributes.role as Role | undefined;
        if (role !== "seller" && role !== "buyer") return;
        const list = tracks.get(participant.id) ?? [];
        // Local audio is never played back to yourself; the local camera's mute state is ours, not the event's.
        const playable = (participant.isLocal ? list.filter((s) => s.mediaStreamTrack.kind === "video") : list).map((s) => s.mediaStreamTrack);
        const video = list.some((s) => s.mediaStreamTrack.kind === "video" && !(participant.isLocal ? localVideo?.isMuted : s.isMuted));
        const audio = list.find((s) => s.mediaStreamTrack.kind === "audio")?.mediaStreamTrack ?? null; // your own mic too, so you see it working
        const side = { stream: playable.length ? new MediaStream(playable) : null, handle: participant.attributes.handle as string, joined: list.length > 0, video, audio };
        setSides((s) => ({ ...s, [role]: side }));
      };
      stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, (participant, streams) => {
        tracks.set(participant.id, [...(tracks.get(participant.id) ?? []), ...streams]);
        if (participant.isLocal) me = participant;
        show(participant);
      });
      stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant, streams) => {
        const gone = new Set(streams.map((s) => s.mediaStreamTrack.id));
        tracks.set(participant.id, (tracks.get(participant.id) ?? []).filter((s) => !gone.has(s.mediaStreamTrack.id)));
        show(participant);
      });
      stage.on(StageEvents.STAGE_STREAM_MUTE_CHANGED, (participant) => show(participant));
      if (localVideo) {
        setCameraOn(true);
        toggleCamera.current = (on) => {
          localVideo.setMuted(!on);
          setCameraOn(on);
          if (me) show(me);
        };
      }
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
      } catch (e) {
        reportError(e);
        setError("Couldn't connect to the round's video. Reload to try again.");
      }
      if (cancelled) leave();
    })();
    return () => {
      cancelled = true;
      leave();
    };
  }, [token, publish, camera]);

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="info">{notice}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: "2px", borderRadius: "12px", overflow: "hidden", bgcolor: "#fff" }}>
        <Pane side={sides.seller} label={`Seller @${sellerHandle}`} bg={hall.seller} />
        <Pane side={sides.buyer} label={`Buyer @${buyerHandle}`} bg={hall.buyer} />
      </Box>
      {cameraOn !== null && (
        <Button variant="outlined" size="small" onClick={() => toggleCamera.current(!cameraOn)} sx={{ justifySelf: "start" }}>
          {cameraOn ? "Turn camera off" : "Turn camera on"}
        </Button>
      )}
    </Box>
  );
}

function Pane({ side, label, bg }: { side: Side; label: string; bg: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Browsers can refuse to play sound without a click on the page (always possible for spectators); offer one.
  const [blocked, setBlocked] = useState(false);
  const play = () => ref.current?.play().then(() => setBlocked(false), () => setBlocked(true));
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = side.stream;
    if (side.stream) play();
  }, [side.stream]);
  return (
    <Box sx={{ position: "relative", aspectRatio: "4 / 3", bgcolor: bg, display: "grid", placeItems: "center" }}>
      {/* The <video> stays mounted without a picture so a mic-only player's audio still plays. */}
      {side.stream && (
        <Box component="video" ref={ref} autoPlay playsInline data-testid={`video-${label.split(" ")[0]!.toLowerCase()}`} sx={{ gridArea: "1 / 1", width: "100%", height: "100%", objectFit: "cover", opacity: side.video ? 1 : 0 }} />
      )}
      {!side.video && <Box sx={{ gridArea: "1 / 1", fontSize: 14, fontWeight: 700, color: hall.muted }}>{side.joined ? "Audio only" : "Waiting to join…"}</Box>}
      {side.audio && <LevelMeter track={side.audio} />}
      {blocked && side.stream && (
        <Button variant="contained" size="small" onClick={play} sx={{ position: "absolute", top: 10, left: 10 }}>
          Turn on sound
        </Button>
      )}
      <Box sx={{ position: "absolute", bottom: 10, left: 10, px: 1, py: 0.5, borderRadius: "6px", bgcolor: "rgba(255,255,255,0.94)", fontSize: 12, fontWeight: 600 }}>{label}</Box>
    </Box>
  );
}

/** A bar that moves with the speaker's voice: Web Audio analyser on the track, drawn without re-rendering React. */
function LevelMeter({ track }: { track: MediaStreamTrack }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser); // analyser only; nothing goes to the speakers
    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const draw = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, (peak / 128) * 2.5)})`;
      frame = requestAnimationFrame(draw);
    };
    ctx.resume().catch(() => {});
    draw();
    return () => {
      cancelAnimationFrame(frame);
      ctx.close();
    };
  }, [track]);
  return (
    <Box aria-hidden sx={{ position: "absolute", left: 16, right: 16, top: "62%", height: 8, borderRadius: 999, bgcolor: "rgba(255,255,255,0.7)", overflow: "hidden" }}>
      <Box ref={bar} sx={{ height: "100%", bgcolor: hall.green, transformOrigin: "left", transform: "scaleX(0)", transition: "transform 80ms linear" }} />
    </Box>
  );
}

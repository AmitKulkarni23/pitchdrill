"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import { studio } from "@/config/tokens";

interface Props {
  /** Called with the live camera+mic stream when the user clicks Join. */
  onJoin: (stream: MediaStream) => void;
  joining?: boolean;
}

function describeError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Camera and microphone access was blocked. Allow both in your browser's site settings, then retry.";
  if (name === "NotFoundError") return "No camera or microphone was found. Plug one in, then retry.";
  if (name === "NotReadableError") return "Your camera or microphone is in use by another app. Close it, then retry.";
  return "Couldn't start your camera and microphone. Check your browser settings and retry.";
}

/** Camera preview, mic level and device pickers before joining the stage. */
export function DeviceCheck({ onJoin, joining }: Props) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState<string>("");
  const [audioId, setAudioId] = useState<string>("");
  const [level, setLevel] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  const start = useCallback(async (v?: string, a?: string) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: v ? { deviceId: { exact: v } } : true,
        audio: a ? { deviceId: { exact: a } } : true,
      });
      setStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return s;
      });
      setError(null);
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void start(), 0);
    return () => clearTimeout(t);
  }, [start]);

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  // Mic level meter.
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      const peak = data.reduce((m, x) => Math.max(m, Math.abs(x - 128)), 0);
      setLevel(Math.min(1, peak / 64));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [stream]);

  // Release the devices if the user leaves without joining (a joined stream is owned by the arena).
  const handedOff = useRef(false);
  useEffect(
    () => () => {
      if (!handedOff.current) stream?.getTracks().forEach((t) => t.stop());
    },
    [stream],
  );

  const cams = devices.filter((d) => d.kind === "videoinput");
  const mics = devices.filter((d) => d.kind === "audioinput");

  return (
    <Box sx={{ display: "grid", gap: 2, maxWidth: 640 }}>
      <Typography variant="h2">Check your camera and mic</Typography>
      {error && (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void start(videoId || undefined, audioId || undefined)}>Retry</Button>}>
          {error}
        </Alert>
      )}
      <Box component="video" ref={video} autoPlay playsInline muted sx={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", bgcolor: studio.cobaltNight, border: `2px solid ${studio.cobaltLine}`, transform: "scaleX(-1)" }} />
      <Box role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} sx={{ height: 8, bgcolor: studio.cobaltNight }}>
        <Box sx={{ height: "100%", bgcolor: studio.cyan, transformOrigin: "left", transform: `scaleX(${level})`, transition: "transform 80ms linear" }} />
      </Box>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        <TextField select label="Camera" size="small" value={videoId} onChange={(e) => { setVideoId(e.target.value); void start(e.target.value, audioId || undefined); }}>
          <MenuItem value="">Default</MenuItem>
          {cams.map((d) => <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</MenuItem>)}
        </TextField>
        <TextField select label="Microphone" size="small" value={audioId} onChange={(e) => { setAudioId(e.target.value); void start(videoId || undefined, e.target.value); }}>
          <MenuItem value="">Default</MenuItem>
          {mics.map((d) => <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</MenuItem>)}
        </TextField>
      </Box>
      <Button
        variant="contained"
        size="large"
        disabled={!stream || joining}
        onClick={() => {
          if (!stream) return;
          handedOff.current = true;
          onJoin(stream);
        }}
        sx={{ justifySelf: "start", fontSize: "1.25rem", px: 4 }}
      >
        {joining ? "Joining…" : "Join the stage"}
      </Button>
    </Box>
  );
}

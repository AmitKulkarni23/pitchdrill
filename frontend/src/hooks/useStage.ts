"use client";

import { useEffect, useState } from "react";

export interface StageTile {
  id: string;
  userId: string;
  attributes: Record<string, string>;
  stream: MediaStream | null;
}

const toStrings = (a: Record<string, unknown> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(a ?? {}).map(([k, v]) => [k, String(v)]));

export type StageState = "idle" | "connecting" | "connected" | "error";

/**
 * Joins an IVS stage with `token`. When `localStream` is given its tracks are published (participants);
 * otherwise the client only subscribes (spectators). Returns the remote participants' tiles.
 * The SDK is imported inside the effect so nothing touches `window` during build or SSR.
 */
export function useStage(token: string | null, localStream?: MediaStream | null) {
  const [tiles, setTiles] = useState<StageTile[]>([]);
  const [state, setState] = useState<StageState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let leave: (() => void) | undefined;
    const tracks = new Map<string, MediaStreamTrack[]>();
    const info = new Map<string, { userId: string; attributes: Record<string, string> }>();

    const publish = () =>
      setTiles(
        [...info].map(([id, p]) => ({ id, ...p, stream: tracks.get(id)?.length ? new MediaStream(tracks.get(id)!) : null })),
      );

    (async () => {
      setState("connecting");
      setError(null);
      const ivs = await import("amazon-ivs-web-broadcast");
      if (cancelled) return;
      const local = localStream ? localStream.getTracks().map((t) => new ivs.LocalStageStream(t)) : [];
      const stage = new ivs.Stage(token, {
        stageStreamsToPublish: () => local,
        shouldPublishParticipant: () => local.length > 0,
        shouldSubscribeToParticipant: () => ivs.SubscribeType.AUDIO_VIDEO,
      });
      leave = () => stage.leave();

      stage.on(ivs.StageEvents.STAGE_CONNECTION_STATE_CHANGED, (s) => setState(s === "connected" ? "connected" : s === "errored" ? "error" : "connecting"));
      stage.on(ivs.StageEvents.STAGE_PARTICIPANT_JOINED, (p) => {
        if (p.isLocal) return;
        info.set(p.id, { userId: p.userId, attributes: toStrings(p.attributes) });
        publish();
      });
      stage.on(ivs.StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, (p, streams) => {
        if (p.isLocal) return;
        info.set(p.id, { userId: p.userId, attributes: toStrings(p.attributes) });
        tracks.set(p.id, [...(tracks.get(p.id) ?? []), ...streams.map((s) => s.mediaStreamTrack)]);
        publish();
      });
      stage.on(ivs.StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (p, streams) => {
        const gone = new Set(streams.map((s) => s.mediaStreamTrack));
        tracks.set(p.id, (tracks.get(p.id) ?? []).filter((t) => !gone.has(t)));
        publish();
      });
      stage.on(ivs.StageEvents.STAGE_PARTICIPANT_LEFT, (p) => {
        info.delete(p.id);
        tracks.delete(p.id);
        publish();
      });
      await stage.join();
    })().catch((e) => {
      if (cancelled) return;
      setState("error");
      setError(e instanceof Error ? e.message : "Couldn't join the stage.");
    });

    return () => {
      cancelled = true;
      leave?.();
      setTiles([]);
      setState("idle");
    };
  }, [token, localStream]);

  return { tiles, state, error };
}

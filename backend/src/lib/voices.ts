import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import * as ivs from "./ivs";

// Speaking levels for the replay: each player's individual recording (AUDIO_ONLY, fMP4 HLS) decoded with ffmpeg and
// reduced to one digit 0–9 per STEP_MS, on the composite recording's timeline. The replay page draws them as meters.
export const STEP_MS = 100;
const RATE = 8000; // Hz; plenty for loudness
const SAMPLES_PER_STEP = (RATE * STEP_MS) / 1000;
const FFMPEG = process.env.AWS_LAMBDA_FUNCTION_NAME ? "/opt/bin/ffmpeg" : "ffmpeg"; // Lambda layer, or PATH locally

export type VoiceLevels<K extends string = "seller" | "buyer"> = Record<K, string>;

/** A run of a media playlist with one init segment and one start time (a new run at each discontinuity). */
export interface PlaylistRun {
  startMs: number;
  init: string;
  segments: string[];
}

/** Splits an IVS media playlist into runs; each run's EXT-X-PROGRAM-DATE-TIME is the wall time of its first sample. */
export function parsePlaylist(text: string): PlaylistRun[] {
  const runs: PlaylistRun[] = [];
  let run: PlaylistRun | undefined;
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (line.startsWith("#EXT-X-MAP:")) runs.push((run = { startMs: NaN, init: /URI="([^"]+)"/.exec(line)![1]!, segments: [] }));
    else if (line.startsWith("#EXT-X-PROGRAM-DATE-TIME:") && run) run.startMs = Date.parse(line.slice(25));
    else if (line && !line.startsWith("#") && run) run.segments.push(line);
  }
  return runs.filter((r) => !Number.isNaN(r.startMs));
}

/** RMS of 16-bit samples → digit: -50 dBFS (or quieter) is 0, -20 dBFS (or louder) is 9. */
export function levelDigit(samples: Int16Array): number {
  let sum = 0;
  for (const v of samples) sum += v * v;
  const db = 20 * Math.log10(Math.sqrt(sum / Math.max(1, samples.length)) / 32768 || 1e-9);
  return Math.max(0, Math.min(9, Math.round(((db + 50) / 30) * 9)));
}

/** Decoded mono PCM placed on a timeline starting at `originMs`: writes the loudest level per step into `levels`. */
export function addLevels(levels: number[], pcm: Int16Array, startMs: number, originMs: number) {
  const offset = Math.round(((startMs - originMs) / 1000) * RATE);
  for (let step = 0; step < levels.length; step++) {
    const from = step * SAMPLES_PER_STEP - offset;
    if (from + SAMPLES_PER_STEP <= 0 || from >= pcm.length) continue;
    levels[step] = Math.max(levels[step]!, levelDigit(pcm.subarray(Math.max(0, from), from + SAMPLES_PER_STEP)));
  }
}

async function decode(bytes: Uint8Array): Promise<Int16Array> {
  const file = `/tmp/voice-${randomUUID()}.mp4`; // a file, not a pipe: the mp4 demuxer wants to seek
  await writeFile(file, bytes);
  try {
    const pcm = await new Promise<Buffer>((resolve, reject) => {
      const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "pipe:1"]);
      const chunks: Buffer[] = [];
      let err = "";
      ff.stdout.on("data", (c: Buffer) => chunks.push(c));
      ff.stderr.on("data", (c: Buffer) => (err += c));
      ff.on("error", reject);
      ff.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exited ${code}: ${err.slice(0, 300)}`))));
    });
    return new Int16Array(Uint8Array.from(pcm).buffer, 0, pcm.length >> 1); // copied: Int16Array needs an even offset
  } finally {
    await unlink(file).catch(() => {});
  }
}

/** Where the composite replay starts (wall time) and how long it is. */
async function compositeTimeline(compositePrefix: string) {
  const ended = JSON.parse(new TextDecoder().decode(await ivs.getObject(`${compositePrefix}/events/recording-ended.json`)));
  const durationMs: number = ended.media.hls.duration_ms;
  const rendition = ended.media.hls.renditions[0];
  const playlist = new TextDecoder().decode(await ivs.getObject(`${compositePrefix}/${ended.media.hls.path}/${rendition.path}/${rendition.playlist}`));
  const pdt = /#EXT-X-PROGRAM-DATE-TIME:(\S+)/.exec(playlist)?.[1];
  // Without a playlist timestamp, the end event's time (second precision) minus the duration.
  return { originMs: pdt ? Date.parse(pdt) : Date.parse(ended.recording_ended_at) - durationMs, durationMs };
}

/**
 * Levels per side, or null while any individual recording is still being finalized (ask again next tick).
 * A side with no recordings gets an empty string.
 */
export async function measureVoices<K extends string>(compositePrefix: string, prefixes: Record<K, string[]>): Promise<VoiceLevels<K> | null> {
  const recordings = {} as Record<K, { root: string; ended: string }[]>;
  for (const [side, list] of Object.entries(prefixes) as [K, string[]][]) {
    const keys = (await Promise.all(list.map(ivs.listKeys))).flat();
    const roots = keys.filter((k) => k.endsWith("/events/recording-started.json")).map((k) => k.slice(0, -"/events/recording-started.json".length));
    if (roots.some((r) => !keys.includes(`${r}/events/recording-ended.json`) && !keys.includes(`${r}/events/recording-failed.json`))) return null;
    recordings[side] = roots.filter((r) => keys.includes(`${r}/events/recording-ended.json`)).map((root) => ({ root, ended: `${root}/events/recording-ended.json` }));
  }
  const { originMs, durationMs } = await compositeTimeline(compositePrefix);
  const out = {} as VoiceLevels<K>;
  for (const side of Object.keys(prefixes) as K[]) {
    if (!recordings[side].length) {
      out[side] = "";
      continue;
    }
    const levels = new Array<number>(Math.ceil(durationMs / STEP_MS)).fill(0);
    for (const { root, ended } of recordings[side]) {
      const hls = JSON.parse(new TextDecoder().decode(await ivs.getObject(ended))).media.hls;
      const dir = `${root}/${hls.path}/${hls.renditions[0].path}`;
      const runs = parsePlaylist(new TextDecoder().decode(await ivs.getObject(`${dir}/${hls.renditions[0].playlist}`)));
      for (const run of runs) {
        // An fMP4 init segment followed by its fragments is one playable file.
        const parts = await Promise.all([run.init, ...run.segments].map((f) => ivs.getObject(`${dir}/${f}`)));
        addLevels(levels, await decode(Buffer.concat(parts)), run.startMs, originMs);
      }
    }
    out[side] = levels.join("");
  }
  return out;
}

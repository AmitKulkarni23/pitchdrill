import { expect, test } from "bun:test";
import { addLevels, levelDigit, parsePlaylist } from "../src/lib/voices";

test("parsePlaylist splits runs at discontinuities, each with its init and start time", () => {
  const runs = parsePlaylist(`#EXTM3U
#EXT-X-VERSION:7
#EXT-X-MAP:URI="init-0.mp4"
#EXT-X-PROGRAM-DATE-TIME:2026-10-25T19:39:00.000Z
#EXTINF:3.3,
0.mp4
#EXTINF:5.6,
1.mp4
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="init-1.mp4"
#EXT-X-PROGRAM-DATE-TIME:2026-10-25T19:40:52.772Z
#EXTINF:2.5,
2.mp4
#EXT-X-ENDLIST`);
  expect(runs).toEqual([
    { startMs: Date.parse("2026-10-25T19:39:00.000Z"), init: "init-0.mp4", segments: ["0.mp4", "1.mp4"] },
    { startMs: Date.parse("2026-10-25T19:40:52.772Z"), init: "init-1.mp4", segments: ["2.mp4"] },
  ]);
});

test("levelDigit: silence 0, full scale 9, -35 dBFS in the middle", () => {
  expect(levelDigit(new Int16Array(800))).toBe(0);
  expect(levelDigit(new Int16Array(800).fill(32767))).toBe(9);
  expect(levelDigit(new Int16Array(800).fill(Math.round(32768 * 10 ** (-35 / 20))))).toBe(5); // (−35+50)/30·9 = 4.5
});

test("addLevels places audio on the composite timeline by wall time", () => {
  const loud = new Int16Array(8000).fill(20000); // 1 s at 8 kHz
  const levels = new Array(30).fill(0); // 3 s in 100 ms steps
  const origin = 1_000_000;
  addLevels(levels, loud, origin + 1000, origin); // starts 1 s into the replay
  expect(levels.join("")).toBe("0".repeat(10) + "9".repeat(10) + "0".repeat(10));
  const early = new Array(30).fill(0);
  addLevels(early, loud, origin - 500, origin); // recording began before the replay: only its last 0.5 s counts
  expect(early.join("")).toBe("9".repeat(5) + "0".repeat(25));
});

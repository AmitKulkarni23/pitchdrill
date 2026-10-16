// Shared in-memory stand-in for src/lib/ivs.ts. Every test file that touches IVS installs it with installFakeIvs().
import { mock } from "bun:test";

export const fake = {
  stages: new Set<string>(),
  rooms: new Set<string>(),
  publishing: new Map<string, string[]>(), // stageArn → userIds
  events: [] as { room: string; name: string; attrs: Record<string, string> }[],
  creates: 0,
  failCreateFor: new Set<string>(),
  recordings: new Set<string>(),
  reset() {
    this.stages.clear();
    this.rooms.clear();
    this.publishing.clear();
    this.events.length = 0;
    this.creates = 0;
    this.failCreateFor.clear();
    this.recordings.clear();
  },
};

export function installFakeIvs() {
  mock.module("../src/lib/ivs", () => ({
    createStage: async (roundId: string) => {
      if (fake.failCreateFor.has(roundId)) throw new Error("IVS down");
      fake.creates++;
      const arn = `stage/${roundId}/${fake.creates}`;
      fake.stages.add(arn);
      return arn;
    },
    deleteStage: async (arn: string) => void fake.stages.delete(arn),
    createRoom: async (roundId: string) => {
      const arn = `room/${roundId}/${fake.creates}`;
      fake.rooms.add(arn);
      return arn;
    },
    deleteRoom: async (arn: string) => void fake.rooms.delete(arn),
    publishingUserIds: async (stageArn: string) => fake.publishing.get(stageArn) ?? [],
    startComposition: async (_stageArn: string, roundId: string) => ({ compositionArn: `composition/${roundId}`, recordingPrefix: `prefix/${roundId}` }),
    stopComposition: async () => {},
    stageToken: async (_arn: string, userId: string, _a: unknown, publish: boolean) => ({ token: `stage:${userId}:${publish ? "pub" : "sub"}` }),
    chatToken: async (_arn: string, userId: string, _a: unknown, canSend: boolean) => ({ token: `chat:${userId}:${canSend ? "send" : "recv"}` }),
    sendRoundEvent: async (room: string, name: string, attrs: Record<string, string>) => void fake.events.push({ room, name, attrs }),
    recordingEnded: async (prefix: string) => fake.recordings.has(prefix),
  }));
}

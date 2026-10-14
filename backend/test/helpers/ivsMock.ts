import { mock } from "bun:test";

/**
 * Every export of lib/ivs as a mock. mock.module is process-wide in bun, so each test file that mocks lib/ivs
 * must provide all exports or later files importing the missing ones fail.
 */
export const ivs = {
  createStage: mock(),
  createRoom: mock(),
  deleteStage: mock(),
  deleteRoom: mock(),
  getActiveSessionId: mock(),
  listPublishingUserIds: mock(),
  startComposition: mock(),
  stopComposition: mock(),
  createStageToken: mock(),
  createChatToken: mock(),
};

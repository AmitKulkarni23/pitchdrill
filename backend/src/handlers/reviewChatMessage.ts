import type { Context } from "aws-lambda";
import { logger } from "../lib/observability";
import { saveComment } from "../lib/rounds";

type ReviewEvent = { Content: string; MessageId: string; Sender: { UserId: string; Attributes?: Record<string, string> } };

// IVS Chat message review handler: saves each spectator message as a comment on its round, then lets it through.
// roundId and nickname come from the chat token's attributes and voterId from its userId (createChatToken), all validated when minted.
// IVS waits at most 200 ms; on a cold start it falls back to ALLOW, but this invocation still finishes the write.
export const handler = async (event: ReviewEvent, context: Context) => {
  logger.addContext(context);
  const { roundId, nickname } = event.Sender.Attributes ?? {};
  const voterId = event.Sender.UserId.replace(/^viewer-/, "");
  if (roundId && voterId && nickname) {
    try {
      await saveComment(roundId, { voterId, nickname, text: event.Content, commentId: event.MessageId });
    } catch (e) {
      logger.error("Chat message not saved", { roundId, error: e as Error });
    }
  } else logger.warn("Chat message without round attributes", { userId: event.Sender.UserId });
  return { ReviewResult: "ALLOW" };
};

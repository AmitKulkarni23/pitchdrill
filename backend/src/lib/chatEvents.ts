import { IvschatClient, SendEventCommand } from "@aws-sdk/client-ivschat";
import { tracer } from "./observability";

const chat = tracer.captureAWSv3Client(new IvschatClient({}));

/** Sends a server event (round_started, buzzer, ...) to everyone in a round's chat room. Attributes are strings only. */
export async function sendRoundEvent(chatRoomArn: string, eventName: string, attributes: Record<string, string> = {}): Promise<void> {
  await chat.send(new SendEventCommand({ roomIdentifier: chatRoomArn, eventName, attributes }));
}

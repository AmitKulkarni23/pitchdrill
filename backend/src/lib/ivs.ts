import {
  CreateParticipantTokenCommand,
  CreateStageCommand,
  DeleteStageCommand,
  GetStageCommand,
  IVSRealTimeClient,
  ListParticipantsCommand,
  StartCompositionCommand,
  StopCompositionCommand,
} from "@aws-sdk/client-ivs-realtime";
import { CreateChatTokenCommand, CreateRoomCommand, DeleteRoomCommand, IvschatClient, SendEventCommand } from "@aws-sdk/client-ivschat";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { tracer } from "./observability";

// All IVS calls live here so tests can mock.module this file.
const stages = tracer.captureAWSv3Client(new IVSRealTimeClient({}));
const chat = tracer.captureAWSv3Client(new IvschatClient({}));
const s3 = tracer.captureAWSv3Client(new S3Client({}));

const isNotFound = (e: unknown) => (e as Error)?.name === "ResourceNotFoundException";
/** Deleting something already gone counts as success, so cleanup can be retried. */
const ignoreNotFound = (e: unknown) => {
  if (!isNotFound(e)) throw e;
};

export async function createStage(roundId: string): Promise<string> {
  const { stage } = await stages.send(new CreateStageCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId } }));
  return stage!.arn!;
}
export const deleteStage = (arn: string) => stages.send(new DeleteStageCommand({ arn })).then(() => {}, ignoreNotFound);

export async function createRoom(roundId: string): Promise<string> {
  const room = await chat.send(new CreateRoomCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId } }));
  return room.arn!;
}
export const deleteRoom = (identifier: string) => chat.send(new DeleteRoomCommand({ identifier })).then(() => {}, ignoreNotFound);

/** userIds of participants currently connected and publishing on the stage's active session. */
export async function publishingUserIds(stageArn: string): Promise<string[]> {
  const { stage } = await stages.send(new GetStageCommand({ arn: stageArn }));
  const sessionId = stage?.activeSessionId;
  if (!sessionId) return [];
  const { participants } = await stages.send(
    new ListParticipantsCommand({ stageArn, sessionId, filterByPublished: true, filterByState: "CONNECTED", maxResults: 50 }),
  );
  return (participants ?? []).map((p) => p.userId ?? "");
}

/** Starts split-screen recording; participants are ordered by their `order` token attribute (seller 1, buyer 2). */
export async function startComposition(stageArn: string, roundId: string) {
  const { composition } = await stages.send(
    new StartCompositionCommand({
      stageArn,
      idempotencyToken: roundId,
      layout: { grid: { participantOrderAttribute: "order", videoFillMode: "COVER" } },
      destinations: [
        {
          s3: {
            storageConfigurationArn: process.env.STORAGE_CONFIGURATION_ARN_ENV!,
            encoderConfigurationArns: [process.env.ENCODER_CONFIGURATION_ARN_ENV!],
          },
        },
      ],
      tags: { round: roundId },
    }),
  );
  return { compositionArn: composition!.arn!, recordingPrefix: composition!.destinations?.[0]?.detail?.s3?.recordingPrefix };
}
export const stopComposition = (arn: string) => stages.send(new StopCompositionCommand({ arn })).then(() => {}, ignoreNotFound);

export async function stageToken(stageArn: string, userId: string, attributes: Record<string, string>, publish: boolean) {
  const { participantToken } = await stages.send(
    new CreateParticipantTokenCommand({
      stageArn,
      userId,
      attributes,
      capabilities: publish ? ["PUBLISH", "SUBSCRIBE"] : ["SUBSCRIBE"],
      duration: 30, // minutes
    }),
  );
  return { token: participantToken!.token!, participantId: participantToken!.participantId };
}

/** IVS Chat token. Empty capabilities = receive only. Shape matches the chat SDK's tokenProvider. */
export async function chatToken(roomArn: string, userId: string, attributes: Record<string, string>, canSend: boolean, minutes: number) {
  const t = await chat.send(
    new CreateChatTokenCommand({
      roomIdentifier: roomArn,
      userId,
      capabilities: canSend ? ["SEND_MESSAGE"] : [],
      attributes,
      sessionDurationInMinutes: minutes,
    }),
  );
  return { token: t.token!, sessionExpirationTime: t.sessionExpirationTime?.toISOString(), tokenExpirationTime: t.tokenExpirationTime?.toISOString() };
}

/** Server event to everyone in a round's chat room (round_started, round_cancelled, buzzer, tally). */
export async function sendRoundEvent(roomArn: string, eventName: string, attributes: Record<string, string>) {
  await chat.send(new SendEventCommand({ roomIdentifier: roomArn, eventName, attributes }));
}

/** True once IVS has written recording-ended.json under a composition's recording prefix. */
export async function recordingEnded(recordingPrefix: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: process.env.RECORDINGS_BUCKET_ENV, Key: `${recordingPrefix}/events/recording-ended.json` }));
    return true;
  } catch (e) {
    if ((e as Error).name === "NotFound") return false;
    throw e;
  }
}

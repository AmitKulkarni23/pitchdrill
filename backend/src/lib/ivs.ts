import {
  CreateParticipantTokenCommand,
  CreateStageCommand,
  DeleteStageCommand,
  GetStageCommand,
  IVSRealTimeClient,
  ListParticipantsCommand,
  ListStageSessionsCommand,
  StartCompositionCommand,
  StopCompositionCommand,
} from "@aws-sdk/client-ivs-realtime";
import { CreateChatTokenCommand, CreateRoomCommand, DeleteRoomCommand, IvschatClient, SendEventCommand } from "@aws-sdk/client-ivschat";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectTaggingCommand, S3Client } from "@aws-sdk/client-s3";
import { tracer } from "./observability";

// All IVS calls live here so tests can mock.module this file.
const stages = tracer.captureAWSv3Client(new IVSRealTimeClient({}));
const chat = tracer.captureAWSv3Client(new IvschatClient({}));
const s3 = tracer.captureAWSv3Client(new S3Client({}));
const cdn = tracer.captureAWSv3Client(new CloudFrontClient({}));

const isNotFound = (e: unknown) => (e as Error)?.name === "ResourceNotFoundException";
/** Deleting something already gone counts as success, so cleanup can be retried. */
const ignoreNotFound = (e: unknown) => {
  if (!isNotFound(e)) throw e;
};

export async function createStage(roundId: string): Promise<string> {
  const { stage } = await stages.send(
    new CreateStageCommand({
      name: `pitchdrill-${roundId}`,
      tags: { round: roundId },
      // Each player's audio on its own, only to measure who speaks when for the replay (voices.ts); deleted after.
      // The reconnect window keeps a dropped-and-rejoined player in one recording. Off locally (no storage configuration).
      ...(process.env.STORAGE_CONFIGURATION_ARN_ENV && {
        autoParticipantRecordingConfiguration: {
          storageConfigurationArn: process.env.STORAGE_CONFIGURATION_ARN_ENV,
          mediaTypes: ["AUDIO_ONLY"],
          thumbnailConfiguration: { recordingMode: "DISABLED" },
          recordingReconnectWindowSeconds: 10,
        },
      }),
    }),
  );
  return stage!.arn!;
}
export const deleteStage = (arn: string) => stages.send(new DeleteStageCommand({ arn })).then(() => {}, ignoreNotFound);

export async function createRoom(roundId: string): Promise<string> {
  // Every spectator message passes through ReviewChatMessage, which saves it as a comment. ALLOW on failure/timeout keeps chat up.
  // Unset locally (bun run dev), so local chat isn't saved.
  const uri = process.env.CHAT_REVIEW_HANDLER_ARN_ENV;
  const room = await chat.send(
    new CreateRoomCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId }, messageReviewHandler: uri ? { uri, fallbackResult: "ALLOW" } : undefined }),
  );
  return room.arn!;
}
export const deleteRoom = (identifier: string) => chat.send(new DeleteRoomCommand({ identifier })).then(() => {}, ignoreNotFound);

/** userIds of participants currently connected and publishing on the stage's active session. */
export async function publishingUserIds(stageArn: string): Promise<string[]> {
  const { stage } = await stages.send(new GetStageCommand({ arn: stageArn }));
  const sessionId = stage?.activeSessionId;
  if (!sessionId) return [];
  const { participants } = await stages.send(
    // IVS accepts only one filter per call, so filter by state and check `published` here.
    new ListParticipantsCommand({ stageArn, sessionId, filterByState: "CONNECTED", maxResults: 100 }),
  );
  return (participants ?? []).filter((p) => p.published).map((p) => p.userId ?? "");
}

/**
 * S3 prefixes of each user's individual recordings on a stage, across all its sessions (rejoins can add more).
 * IVS writes them under `<stageId>/<sessionId>/<participantId>/<timestamp>/`.
 */
export async function participantRecordingPrefixes<K extends string>(stageArn: string, userIds: Record<K, string>): Promise<Record<K, string[]>> {
  const stageId = stageArn.split("/").pop();
  const { stageSessions = [] } = await stages.send(new ListStageSessionsCommand({ stageArn, maxResults: 50 }));
  const out = {} as Record<K, string[]>;
  for (const [key, userId] of Object.entries(userIds) as [K, string][]) {
    const lists = await Promise.all(
      stageSessions.map(({ sessionId }) => stages.send(new ListParticipantsCommand({ stageArn, sessionId, filterByUserId: userId, maxResults: 100 }))),
    );
    out[key] = lists.flatMap((l, i) => (l.participants ?? []).map((p) => `${stageId}/${stageSessions[i]!.sessionId}/${p.participantId}`));
  }
  return out;
}

/** Polls every 2 s until every one of `userIds` is publishing or `until` (epoch ms) passes; returns who is publishing. */
export async function waitForPublishers(stageArn: string, userIds: string[], until: number): Promise<string[]> {
  for (;;) {
    const publishing = await publishingUserIds(stageArn);
    if (userIds.every((u) => publishing.includes(u)) || Date.now() + 2000 > until) return publishing;
    await new Promise((r) => setTimeout(r, 2000));
  }
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

/**
 * Takes a hidden round's replay off the CDN: tags every object under its prefix hidden=true (the bucket policy then
 * denies CloudFront those objects) and invalidates cached copies. The recording itself is kept. Safe to repeat.
 */
export async function hideRecording(recordingPrefix: string) {
  const Bucket = process.env.RECORDINGS_BUCKET_ENV;
  let ContinuationToken: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `${recordingPrefix}/`, ContinuationToken }));
    await Promise.all(
      (page.Contents ?? []).map(({ Key }) => s3.send(new PutObjectTaggingCommand({ Bucket, Key, Tagging: { TagSet: [{ Key: "hidden", Value: "true" }] } }))),
    );
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
  await cdn.send(
    new CreateInvalidationCommand({
      DistributionId: process.env.RECORDINGS_CDN_ID_ENV,
      InvalidationBatch: { CallerReference: `hide-${recordingPrefix}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/${recordingPrefix}/*`] } },
    }),
  );
}

const Bucket = () => process.env.RECORDINGS_BUCKET_ENV;

/** Every object key under `prefix/`. */
export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: Bucket(), Prefix: `${prefix}/`, ContinuationToken }));
    keys.push(...(page.Contents ?? []).map((o) => o.Key!));
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
  return keys;
}

export async function getObject(Key: string): Promise<Uint8Array> {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: Bucket(), Key }));
  return Body!.transformToByteArray();
}

/** Deletes every object under `prefix/`. */
export async function deletePrefix(prefix: string) {
  const keys = await listKeys(prefix);
  for (let i = 0; i < keys.length; i += 1000)
    await s3.send(new DeleteObjectsCommand({ Bucket: Bucket(), Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
}

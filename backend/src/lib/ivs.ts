import {
  CreateStageCommand,
  DeleteStageCommand,
  GetStageCommand,
  ResourceNotFoundException,
  StopCompositionCommand,
  IVSRealTimeClient,
  ListParticipantsCommand,
  StartCompositionCommand,
} from "@aws-sdk/client-ivs-realtime";
import { CreateRoomCommand, DeleteRoomCommand, IvschatClient, ResourceNotFoundException as ChatNotFound } from "@aws-sdk/client-ivschat";
import { tracer } from "./observability";

const stages = tracer.captureAWSv3Client(new IVSRealTimeClient({}));
const rooms = tracer.captureAWSv3Client(new IvschatClient({}));

/** Creates the IVS Real-Time stage for a round and returns its ARN. */
export async function createStage(roundId: string): Promise<string> {
  const { stage } = await stages.send(new CreateStageCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId } }));
  if (!stage?.arn) throw new Error("CreateStage returned no ARN");
  return stage.arn;
}

/** Deleting a stage that is already gone counts as success. */
export async function deleteStage(arn: string): Promise<void> {
  await stages.send(new DeleteStageCommand({ arn })).catch((e) => {
    if (!(e instanceof ResourceNotFoundException)) throw e;
  });
}

/** Creates the IVS Chat room for a round and returns its ARN. */
export async function createRoom(roundId: string): Promise<string> {
  const { arn } = await rooms.send(new CreateRoomCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId } }));
  if (!arn) throw new Error("CreateRoom returned no ARN");
  return arn;
}

/** Deleting a room that is already gone counts as success. */
export async function deleteRoom(arn: string): Promise<void> {
  await rooms.send(new DeleteRoomCommand({ identifier: arn })).catch((e) => {
    if (!(e instanceof ChatNotFound)) throw e;
  });
}

/** Stops a composition; already stopped or deleted counts as success. */
export async function stopComposition(arn: string): Promise<void> {
  await stages.send(new StopCompositionCommand({ arn })).catch((e) => {
    if (!(e instanceof ResourceNotFoundException)) throw e;
  });
}

/** The stage's current session ID, or undefined when nobody has joined. */
export async function getActiveSessionId(stageArn: string): Promise<string | undefined> {
  const { stage } = await stages.send(new GetStageCommand({ arn: stageArn }));
  return stage?.activeSessionId || undefined;
}

/** User IDs (booking IDs) of participants currently connected and publishing. */
export async function listPublishingUserIds(stageArn: string, sessionId: string): Promise<string[]> {
  const ids: string[] = [];
  let nextToken: string | undefined;
  do {
    const page = await stages.send(
      new ListParticipantsCommand({ stageArn, sessionId, filterByPublished: true, filterByState: "CONNECTED", nextToken }),
    );
    for (const p of page.participants ?? []) if (p.userId) ids.push(p.userId);
    nextToken = page.nextToken;
  } while (nextToken);
  return ids;
}

/**
 * Starts the split-screen recording to S3 and returns the composition ARN.
 * The grid orders tiles by the participant `order` attribute: seller "1" on the left, buyer "2" on the right.
 */
export async function startComposition(stageArn: string): Promise<string> {
  const { composition } = await stages.send(
    new StartCompositionCommand({
      stageArn,
      layout: { grid: { participantOrderAttribute: "order" } },
      destinations: [
        {
          s3: {
            storageConfigurationArn: process.env.STORAGE_CONFIGURATION_ARN_ENV,
            encoderConfigurationArns: [process.env.ENCODER_CONFIGURATION_ARN_ENV!],
          },
        },
      ],
    }),
  );
  if (!composition?.arn) throw new Error("StartComposition returned no ARN");
  return composition.arn;
}

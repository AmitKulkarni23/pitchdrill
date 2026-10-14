import { CreateStageCommand, DeleteStageCommand, IVSRealTimeClient } from "@aws-sdk/client-ivs-realtime";
import { CreateRoomCommand, DeleteRoomCommand, IvschatClient } from "@aws-sdk/client-ivschat";
import { tracer } from "./observability";

const stages = tracer.captureAWSv3Client(new IVSRealTimeClient({}));
const rooms = tracer.captureAWSv3Client(new IvschatClient({}));

/** Creates the IVS Real-Time stage for a round and returns its ARN. */
export async function createStage(roundId: string): Promise<string> {
  const { stage } = await stages.send(new CreateStageCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId } }));
  if (!stage?.arn) throw new Error("CreateStage returned no ARN");
  return stage.arn;
}

export async function deleteStage(arn: string): Promise<void> {
  await stages.send(new DeleteStageCommand({ arn }));
}

/** Creates the IVS Chat room for a round and returns its ARN. */
export async function createRoom(roundId: string): Promise<string> {
  const { arn } = await rooms.send(new CreateRoomCommand({ name: `pitchdrill-${roundId}`, tags: { round: roundId } }));
  if (!arn) throw new Error("CreateRoom returned no ARN");
  return arn;
}

export async function deleteRoom(arn: string): Promise<void> {
  await rooms.send(new DeleteRoomCommand({ identifier: arn }));
}

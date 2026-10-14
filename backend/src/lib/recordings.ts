import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { tracer } from "./observability";

const s3 = tracer.captureAWSv3Client(new S3Client({}));
const idOf = (arn: string) => arn.split("/").pop()!;

/**
 * S3 key of a finished composition's HLS multivariant playlist, or undefined while it is not there yet.
 * ponytail: the exact key layout of IVS composite recordings is unconfirmed (docs were unreachable when this was
 * written). We try `<stageId>/<compositionId>/` then `<compositionId>/` and accept the first `multivariant.m3u8`.
 * Verify against the first real recording and fix the prefixes here (see data_model.md).
 */
export async function findPlaylist(stageArn: string, compositionArn: string): Promise<string | undefined> {
  const compositionId = idOf(compositionArn);
  for (const prefix of [`${idOf(stageArn)}/${compositionId}/`, `${compositionId}/`]) {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: process.env.RECORDINGS_BUCKET_ENV, Prefix: prefix, MaxKeys: 50 }));
    const hit = out.Contents?.find((o) => o.Key?.endsWith("multivariant.m3u8"));
    if (hit?.Key) return hit.Key;
  }
}

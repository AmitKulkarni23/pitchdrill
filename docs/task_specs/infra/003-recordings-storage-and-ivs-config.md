# Task: 003 — Recordings bucket, CloudFront and IVS composition config

## Summary

Rounds are recorded by IVS server-side composition into S3 and replayed through CloudFront. This task adds the bucket, the CloudFront distribution (Origin Access Control), the IVS storage configuration and encoder configuration, and introduces CDK assertion tests for the stack. Nothing records yet; TASK-007 starts compositions. See `docs/system_specs/architecture.md` §2 and §3 (Recording).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §2 AWS Components, §3 Decisions (Recording, CORS)
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Infrastructure

1. An S3 bucket MUST be created with `blockPublicAccess: BLOCK_ALL`, `enforceSSL: true`, S3-managed encryption, `removalPolicy: RETAIN`, named `pitchdrill-recordings-<account>` (use `this.account`, never a literal).
2. A CloudFront distribution MUST serve the bucket via `S3BucketOrigin.withOriginAccessControl`, HTTPS only, default CloudFront domain (no custom domain, no certificate).
3. The distribution MUST attach a response headers policy with CORS for the same origins as the API (`ALLOWED_ORIGINS`), methods GET/HEAD, so hls.js can fetch playlists and segments.
4. An `AWS::IVS::EncoderConfiguration` (`CfnEncoderConfiguration`) named `pitchdrill-composite` MUST be created: 1280×720, 30 fps, bitrate 2,500,000.
5. An `AWS::IVS::StorageConfiguration` (`CfnStorageConfiguration`) named `pitchdrill-recordings` MUST point at the bucket.
6. If IVS needs a bucket policy to write composition output, add it with `bucket.addToResourcePolicy` (resource policy, not a role policy) with a comment citing the AWS doc. Verify against the AWS docs for "IVS real-time server-side composition S3 destination" before deploying.
7. Outputs MUST include `PitchDrillRecordingsCdnDomain` (exportName `PitchDrillRecordingsCdnDomain`) for the frontend. Keep the storage/encoder ARNs as stack properties for TASK-007 (no output needed).

### Tests

8. Add `infra/test/backend-stack.test.ts` using `aws-cdk-lib/assertions` and `bun test`; add `"test"` to `infra/package.json`. The test MUST build the backend first if `backend/dist` is missing (Code.fromAsset needs the folder).

## Technical Notes

- `ALLOWED_ORIGINS` already exists at the top of the stack; reuse it.
- Adding a bucket to an existing stack: an update failure rolls back cleanly; the "stranded retained resource" problem only happens on a first create.
- Do not set `RemovalPolicy.DESTROY` on the bucket (prod stateful resource rule).

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `stack: recordings bucket should block all public access and enforce SSL` | bucket properties + policy | `infra/test/backend-stack.test.ts` |
| 2 | `stack: distribution should use origin access control` | `AWS::CloudFront::OriginAccessControl` exists and is referenced | `infra/test/backend-stack.test.ts` |
| 3 | `stack: distribution should send CORS headers for allowed origins` | response headers policy | `infra/test/backend-stack.test.ts` |
| 4 | `stack: storage configuration should point at the recordings bucket` | `AWS::IVS::StorageConfiguration` S3 bucket ref | `infra/test/backend-stack.test.ts` |
| 5 | `stack: encoder configuration should be 720p30 at 2.5 Mbps` | properties | `infra/test/backend-stack.test.ts` |
| 6 | `stack: table should be retained with deletion protection` | phase 1 guarantee | `infra/test/backend-stack.test.ts` |

### GREEN — Implementation Order

1. Test harness + test 6 (existing behaviour).
2. Bucket + distribution (tests 1–3).
3. IVS configs (tests 4–5).

### REFACTOR

- Group the new resources under a `// 2b. MEDIA LAYER` style numbered section.

## Dependencies

- `TASK-002` — stack structure after the route refactor

## Files to Create/Modify

- `infra/lib/backend-stack.ts` (modify)
- `infra/test/backend-stack.test.ts` (create)
- `infra/package.json` (modify — test script)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; `bun run typecheck` clean in `infra/`
- [ ] `cdk diff` reviewed (additions only), deployed
- [ ] Output `PitchDrillRecordingsCdnDomain` present; anonymous `curl` to the bucket's S3 URL is denied

## Spec Updates

- [ ] Update `CLAUDE.md` Commands — `cd infra && bun test`
- [ ] Update `docs/system_specs/architecture.md` §2 if names differ

# Task: 008 — SlotTick: buzzer, cleanup and replay registration

## Summary

End live rounds 60 seconds after they start, close chat rooms after 15 minutes, and register each finished recording so it appears in the replay feed. See `docs/system_specs/architecture.md` §4 and `docs/system_specs/data_model.md` (`recordingPath`, GSI1).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §4 Lifecycle
- `docs/system_specs/data_model.md` — `META`, GSI1
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `tick` MUST end every `live` round with `now ≥ startedAt + 60s` via `endRound(round)`: `SendEvent` `buzzer`, `StopComposition`, `DeleteStage`, then `META` `SET status = "ended", endedAt` (condition `status = "live"`).
2. `endRound` MUST be exported for reuse by the admin "end round" route (TASK-013), accepting an optional `endedBy: "admin"` stored on `META`.
3. `tick` MUST close every `ended` round with `now ≥ T + 15m`: `DeleteRoom`, then `META` `SET status = "closed"` (condition `status = "ended"`).
4. For `ended`/`closed` rounds without `recordingPath` and not `hidden`, `tick` MUST look for the composition's HLS multivariant playlist in the recordings bucket. When found: `SET recordingPath, GSI1PK = "REPLAY", GSI1SK = endedAt`.
5. A round still without a recording at `T + 20m` MUST log a warning once and emit `RecordingMissing`.
6. Deleting an already-deleted stage or room (`ResourceNotFoundException`) MUST be treated as success.

### Infrastructure

7. `PitchDrillSlotTick` MUST get `bucket.grantRead` and env `RECORDINGS_BUCKET_ENV`.
8. IVS permissions (scoped `addToRolePolicy`): `ivs:StopComposition` on `composition/*`; `ivs:DeleteStage` already granted; `ivschat:DeleteRoom` already granted.

## Technical Notes

- Determine the S3 key layout for composite recordings from the AWS docs ("IVS real-time composite recording, S3 key structure") and from the `compositionArn`. Expect a prefix derived from the stage and composition IDs ending in `.../media/hls/multivariant.m3u8` (or similar). Confirm with the docs or a real recording before relying on it, and record the confirmed layout in `data_model.md`.
- Use `ListObjectsV2` with that prefix and `MaxKeys` small; do not scan the bucket.
- The round window in `tick` (`now - 20m ≤ T`) covers close + recording checks.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `tick: given a live round started 61s ago, should send buzzer, stop composition, delete stage, set ended` | calls + META | `backend/test/slotTick.end.test.ts` |
| 2 | `tick: given a live round started 30s ago, should leave it live` | no calls | `backend/test/slotTick.end.test.ts` |
| 3 | `tick: given an ended round at T+15m, should delete room and set closed` | META | `backend/test/slotTick.end.test.ts` |
| 4 | `tick: given the playlist exists in S3, should set recordingPath and GSI1 keys` | META | `backend/test/slotTick.end.test.ts` |
| 5 | `tick: given no playlist at T+20m, should emit RecordingMissing once` | metric | `backend/test/slotTick.end.test.ts` |
| 6 | `endRound: given ResourceNotFound on DeleteStage, should still set ended` | META | `backend/test/slotTick.end.test.ts` |

### GREEN — Implementation Order

1. `endRound` (tests 1, 2, 6).
2. Close phase (test 3).
3. Recording registration (tests 4–5).
4. CDK grants/env.

### REFACTOR

- Split `slotTick.ts` phases into `backend/src/lib/lifecycle/{open,start,end}.ts` if the handler exceeds ~250 lines.

## Dependencies

- `TASK-007`

## Files to Create/Modify

- `backend/src/handlers/slotTick.ts` (modify)
- `backend/src/lib/ivs.ts` (modify)
- `backend/test/slotTick.end.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed
- [ ] S3 key layout confirmed and documented

## Spec Updates

- [ ] Update `docs/system_specs/data_model.md` — exact `recordingPath` format

# Task: 007 — SlotTick: start rounds or cancel no-shows (T)

## Summary

At slot start, each `ready` round either goes live or is cancelled. If both the seller and the buyer are publishing on the stage, start IVS server-side composition (split-screen recording to S3), set `startedAt` and status `live`, and tell everyone with a chat event. Otherwise cancel the round as a no-show and clean up the stage and room. See `docs/system_specs/architecture.md` §4.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 (Recording, Chat, No-shows), §4 Lifecycle
- `docs/system_specs/data_model.md` — `META`
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `tick` MUST run `startSlot(slotId)` for slots where `T ≤ now` and rounds are still `ready`.
2. For each `ready` round: `GetStage` → `activeSessionId`. With no active session, the round is a no-show.
3. With a session: `ListParticipants({ stageArn, sessionId, filterByPublished: true, filterByState: "CONNECTED" })`; the round goes live only if both `sellerBookingId` and `buyerBookingId` appear as `userId` (TASK-009 issues join tokens with `userId = bookingId`).
4. Live: `StartComposition` with destination `s3: { storageConfigurationArn, encoderConfigurationArns: [encoderArn] }` and a grid layout ordering participants by the `order` attribute (seller `"1"`, buyer `"2"`; see `participantOrderAttribute` in the IVS grid configuration). Then update `META` `SET status = "live", startedAt, compositionArn` with `ConditionExpression: status = "ready"`, emit `RoundStarted`, and `SendEvent` `round_started` with attribute `startedAt`.
5. No-show: update `META` `SET status = "cancelled", cancelReason = "no_show"` (condition `status = "ready"`), `SendEvent` `round_cancelled` (attribute `reason`), then `DeleteStage` and `DeleteRoom`. Emit `RoundCancelled`.
6. `backend/src/lib/chatEvents.ts` MUST export `sendRoundEvent(chatRoomArn, eventName, attributes)` wrapping IVS Chat `SendEvent` (string attributes only). It is reused by TASK-008 and TASK-011.
7. Idempotent and per-round error isolation as in TASK-006.

### Infrastructure

8. `PitchDrillSlotTick` env MUST add `STORAGE_CONFIGURATION_ARN_ENV` and `ENCODER_CONFIGURATION_ARN_ENV` (from TASK-003 resources).
9. IVS permissions (scoped `addToRolePolicy`, commented): `ivs:GetStage`, `ivs:ListParticipants`, `ivs:StartComposition` on `stage/*`; `ivs:StartComposition` also on the storage configuration and encoder configuration ARNs; `ivschat:SendEvent` on `room/*`. If CloudTrail shows `AccessDenied` for a related read action (e.g. `ivs:GetStorageConfiguration`), add that exact action on that exact resource.

## Technical Notes

- `StartComposition` needs an active stage session; it fails if nobody has joined. That is why it runs only after the participant check.
- Verify the exact `StartComposition` request shape (`layout.grid`, `destinations[].s3`) against the current AWS SDK v3 types in `node_modules/@aws-sdk/client-ivs-realtime`; follow the types over this spec if they differ, and note it under Spec Updates.
- The 2-minute timer is shown by clients from `startedAt`; the server ends the round in TASK-008.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `startSlot: given both participants publishing, should start composition and set status live` | META + StartComposition args | `backend/test/slotTick.start.test.ts` |
| 2 | `startSlot: should send round_started with startedAt` | SendEvent args | `backend/test/slotTick.start.test.ts` |
| 3 | `startSlot: given only the seller publishing, should cancel as no_show and delete stage + room` | META + deletes | `backend/test/slotTick.start.test.ts` |
| 4 | `startSlot: given no active session, should cancel as no_show` | status cancelled | `backend/test/slotTick.start.test.ts` |
| 5 | `startSlot: given a round already live, should do nothing` | no IVS calls | `backend/test/slotTick.start.test.ts` |
| 6 | `tick: before T, should not start rounds` | status stays ready | `backend/test/slotTick.start.test.ts` |

### GREEN — Implementation Order

1. `chatEvents.ts`.
2. IVS wrappers for `GetStage`, `ListParticipants`, `StartComposition` in `lib/ivs.ts`.
3. `startSlot` (tests 1–6).
4. CDK env + permissions.

### REFACTOR

- Share the "conditional status transition" helper between open/start (e.g. `transitionRound(roundId, from, to, extra)`).

## Dependencies

- `TASK-003` — storage + encoder configurations
- `TASK-006` — SlotTick, `lib/ivs.ts`

## Files to Create/Modify

- `backend/src/handlers/slotTick.ts` (modify)
- `backend/src/lib/ivs.ts` (modify)
- `backend/src/lib/chatEvents.ts` (create)
- `backend/test/slotTick.start.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify)
- `infra/test/backend-stack.test.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed
- [ ] IAM limited to listed actions/resources

## Spec Updates

- [ ] Update `docs/system_specs/architecture.md` §4 if the composition request differs from this spec

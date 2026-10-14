# Task: 006 — SlotTick: open slots (T-5 minutes)

## Summary

Add the scheduled `SlotTick` Lambda that drives every round through its lifecycle. This task implements the first step: five minutes before a slot starts, pair any leftover waiters, mark the rest `no_opponent`, make sure every round has briefs, and create an IVS Real-Time stage and an IVS Chat room for each paired round (status `paired` → `ready`). See `docs/system_specs/architecture.md` §4.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 (IAM, Live video, Chat), §4 Lifecycle
- `docs/system_specs/data_model.md` — Booking `status`, `STATS`, `META`
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `handlers/slotTick.ts` MUST export `handler` (EventBridge Scheduler event) and a `tick(now: number)` function containing all logic.
2. `tick` MUST consider slots whose start `T` satisfies `now - 20m ≤ T ≤ now + 5m` (later tasks add more phases) and run `openSlot(slotId)` when `T - 5m ≤ now`.
3. `openSlot` MUST pair leftover waiters oldest-first (one seller + one buyer per pair) using the same pairing transaction as `createBooking` (extract a shared `pairWaiting(...)` function in `bookings.ts`).
4. Remaining waiters MUST get booking `status: "no_opponent"`, their `WAIT#` item deleted and `STATS` decremented, in one transaction each.
5. For each round with status `paired`: if `briefs` is missing, call `generateBriefs()`; on failure use `fallbackBriefs()` and emit `BriefFallbackUsed`.
6. For each round with status `paired`: `CreateStage` (name `pitchdrill-<roundId>`, tag `round=<roundId>`) and `CreateRoom` (IVS Chat, name `pitchdrill-<roundId>`), then update `META` `SET status = "ready", stageArn, chatRoomArn` with `ConditionExpression: status = "paired"`. If the condition fails (a concurrent tick won), delete the stage and room just created.
7. Every step MUST be idempotent: running `tick` twice for the same `now` MUST NOT create duplicate stages or change results.
8. Errors for one round MUST be logged and MUST NOT stop other rounds.
9. `backend/src/dev/server.ts` MUST add dev-only `POST /dev/tick?now=<iso>` calling `tick(Date.parse(now) || Date.now())`.

### Infrastructure

10. Lambda `PitchDrillSlotTick` (60 s timeout, 512 MB, `reservedConcurrentExecutions: 1`, tracing, 1-month logs) with env `TABLE_NAME_ENV`, `OPENROUTER_SECRET_ARN_ENV`, `OPENROUTER_MODEL_ENV`.
11. An EventBridge Scheduler schedule (`aws-cdk-lib/aws-scheduler` + `aws-scheduler-targets`) MUST invoke it every minute from 15:00 to 21:59 `America/Los_Angeles` (`ScheduleExpression.cron({ minute: "*", hour: "15-21", timeZone: TimeZone.AMERICA_LOS_ANGELES })`) with `retryAttempts: 0`.
12. Grants: `table.grantReadWriteData`, `secret.grantRead`. IVS permissions via `addToRolePolicy` (comment: "IVS has no CDK grant methods"): `ivs:CreateStage`, `ivs:DeleteStage`, `ivs:TagResource` on `stage/*`; `ivschat:CreateRoom`, `ivschat:DeleteRoom`, `ivschat:TagResource` on `room/*`. Build ARNs with `Stack.formatArn` (service `ivs` / `ivschat`).
13. Alarms: `pitchdrill-rounds-not-starting` (ERROR logs in SlotTick ≥ 1 in 5 min) and `pitchdrill-rounds-using-fallback-briefs` (`BriefFallbackUsed` ≥ 3 in 1 hour), with user-impact descriptions.

## Technical Notes

- SDKs: `@aws-sdk/client-ivs-realtime` (`CreateStageCommand`, `DeleteStageCommand`) and `@aws-sdk/client-ivschat` (`CreateRoomCommand`, `DeleteRoomCommand`). Add as dependencies (external in the bundle). Wrap clients with `tracer.captureAWSv3Client`.
- Put IVS calls in `backend/src/lib/ivs.ts` so tests can `mock.module` it.
- `reservedConcurrentExecutions: 1` stops overlapping ticks; with `retryAttempts: 0` a throttled invoke is simply skipped and the next minute catches up.
- Slot IDs for "today" come from `slotsForDate(pacificDate(now))`; also include the previous Pacific date so the T+20m window works right after midnight UTC changes.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `tick: given now outside any slot window, should do nothing` | no IVS calls, no writes | `backend/test/slotTick.open.test.ts` |
| 2 | `openSlot: given 2 waiting sellers and 1 waiting buyer, should pair the oldest seller and mark the other no_opponent` | statuses + STATS | `backend/test/slotTick.open.test.ts` |
| 3 | `openSlot: given a paired round, should create stage + room and set status ready` | META fields, IVS mock calls | `backend/test/slotTick.open.test.ts` |
| 4 | `openSlot: given briefs missing and generation failing, should store fallback briefs` | `briefs.source = fallback` | `backend/test/slotTick.open.test.ts` |
| 5 | `tick: run twice, should create each stage once` | IVS create called once per round | `backend/test/slotTick.open.test.ts` |
| 6 | `openSlot: given IVS failure for one round, should still open the others` | other round ready | `backend/test/slotTick.open.test.ts` |
| 7 | `dev server: POST /dev/tick should call tick with the given time` | tick invoked | `backend/test/devServer.test.ts` |

### GREEN — Implementation Order

1. Extract `pairWaiting` from `createBooking` (existing tests stay green).
2. `lib/ivs.ts` wrappers.
3. `tick` + `openSlot` (tests 1–6).
4. Dev route (test 7).
5. CDK Lambda, schedule, permissions, alarms.

### REFACTOR

- Keep `createBooking` and `openSlot` sharing one pairing transaction builder.

## Dependencies

- `TASK-001`, `TASK-002`, `TASK-005`

## Files to Create/Modify

- `backend/src/handlers/slotTick.ts` (create)
- `backend/src/lib/ivs.ts` (create)
- `backend/src/lib/bookings.ts` (modify — extract `pairWaiting`)
- `backend/src/dev/server.ts` (modify — `/dev/tick`)
- `backend/test/slotTick.open.test.ts` (create), `backend/test/devServer.test.ts` (modify)
- `backend/package.json` (modify — IVS SDKs)
- `infra/lib/backend-stack.ts` (modify)
- `infra/test/backend-stack.test.ts` (modify — schedule + IAM assertions)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] Deployed; the schedule shows `America/Los_Angeles` and fires (check `PitchDrillSlotTick` logs)
- [ ] IAM statements limited to the listed actions and ARN patterns

## Spec Updates

- [ ] Update `docs/system_specs/architecture.md` §4 if any transition detail changed

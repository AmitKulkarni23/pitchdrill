# Task: 017 — Participant arena (split screen, brief, timer)

## Summary

The seller and buyer enter the arena from their ticket page: camera/mic check, join the IVS stage, see each other side by side, read their own brief from 30 seconds before start, and run the 60-second round with a visible timer and buzzer. See `docs/system_specs/architecture.md` §4 timeline and §6.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 (Live video, Chat), §4 Lifecycle, §5 (`join`, `brief`)

## Requirements

### Frontend

1. Install `amazon-ivs-web-broadcast` and `amazon-ivs-chat-messaging` at exact versions. Load them only in client components (`"use client"`, dynamic import) so `bun run build` does not touch `window`.
2. Before joining, show a device check: camera preview, mic level, device pickers, and clear messages for denied permissions.
3. **Join** MUST call `POST /rounds/{roundId}/join` with the ticket, then join the stage with `stageToken`, publishing camera + mic (`shouldPublishParticipant: () => true`, `shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO`).
4. `components/SplitScreen.tsx` MUST place the seller on the left and the buyer on the right using participant `attributes.role` (local preview on your side), with handle + role labels. It is reused by spectators (TASK-018). Stacks vertically on narrow screens.
5. Connect to IVS Chat with `chatToken` (read-only) and listen for events: `round_started` (start the timer from `startedAt`), `buzzer`, `round_cancelled`. Also poll `GET /rounds/{roundId}` every 5 s as a fallback.
6. Brief panel: from `T - 30s`, fetch `GET /rounds/{roundId}/brief` (retry on `brief_not_yet` at `availableAt`, and every 3 s on `brief_pending`). Show product name, price, tagline and your side's brief. Before T-30s show a countdown to the brief.
7. Timer: before start, countdown to T; when live, 60 → 0 from `startedAt`; at 0 (or on `buzzer`), stop publishing locally, show "Buzzer!" and then the live vote tally (from `tally` events / round polling) and a link to the replay page.
8. `round_cancelled` MUST show "Your opponent didn't show" and leave the stage.
9. Leaving the page MUST leave the stage and disconnect chat.

## Technical Notes

- Keep timing logic pure: `arenaPhase(now, slotStart, startedAt?, status)` → `pre-brief | brief | starting | live | buzzer | cancelled | ended`.
- Token expiry is 30 min, which covers the round; no refresh needed.
- Do not use browser automation to test; the user tests with two browsers/devices against the deployed or local backend.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `arenaPhase: before T-30s should be pre-brief` | phase | `frontend/src/lib/arena.test.ts` |
| 2 | `arenaPhase: between T-30s and start should be brief/starting` | phase | `frontend/src/lib/arena.test.ts` |
| 3 | `arenaPhase: live with startedAt 59s ago should be live with 1s left` | phase + remaining | `frontend/src/lib/arena.test.ts` |
| 4 | `arenaPhase: 60s after startedAt should be buzzer` | phase | `frontend/src/lib/arena.test.ts` |
| 5 | `parseRoundEvent: should parse round_started, buzzer, round_cancelled, tally` | typed events | `frontend/src/lib/arena.test.ts` |
| 6 | `sideForRole: seller left, buyer right` | layout mapping | `frontend/src/lib/arena.test.ts` |

### GREEN — Implementation Order

1. `lib/arena.ts` (tests 1–6).
2. `components/DeviceCheck.tsx`, `SplitScreen.tsx`, `BriefPanel.tsx`, `RoundTimer.tsx`.
3. `components/Arena.tsx` (stage + chat wiring) used by the ticket page.

### REFACTOR

- Extract `useStage(token, options)` and `useRoundEvents(chatToken)` hooks for reuse in TASK-018.

## Dependencies

- `TASK-016`, `TASK-009`, `TASK-007`

## Files to Create/Modify

- `frontend/src/lib/arena.ts` (+ test)
- `frontend/src/components/Arena.tsx`, `DeviceCheck.tsx`, `SplitScreen.tsx`, `BriefPanel.tsx`, `RoundTimer.tsx`
- `frontend/src/hooks/useStage.ts`, `useRoundEvents.ts`
- `frontend/src/app/t/[ticket]/page.tsx` (modify)
- `frontend/package.json` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; build, lint, typecheck clean
- [ ] User verifies a full round with two browsers: split screen, briefs per side, timer, buzzer

## Spec Updates

- [ ] Update `CLAUDE.md` Folder Structure — add `src/hooks/`

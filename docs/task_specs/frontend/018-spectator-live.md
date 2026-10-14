# Task: 018 — Live rounds, spectator view, chat and voting

## Summary

Anyone can watch rounds live without a ticket: a "Live now" list on the home page, a watch page with the split screen, live chat under a nickname typed once, and Sold / Not sold voting at the buzzer with a live tally. See `docs/system_specs/architecture.md` §3 (Chat, Votes) and §6 (Spectator).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3, §5 (`/rounds/live`, `watch`, `chat-token`, `votes`), §6
- `docs/system_specs/data_model.md` — Limits and Validation (`nickname`)

## Requirements

### Frontend

1. Home MUST show "Live now" from `GET /rounds/live` (refresh every 15 s while visible): "@amit vs @riya · live / starting soon", each linking to `/watch/[roundId]`. Hidden when empty.
2. `/watch/[roundId]` MUST call `POST /rounds/{roundId}/watch` with `getVoterId()` and join the stage subscribe-only (`shouldPublishParticipant: () => false`), rendering `SplitScreen` (TASK-017).
3. Chat panel MUST connect with a `tokenProvider` that calls `POST /rounds/{roundId}/chat-token` with `voterId` + nickname. If no nickname is saved, prompt for one (validated like the backend) the first time the user focuses the chat input; save with `setNickname`. Handle `nickname_taken` inline.
4. Messages MUST show nickname (from sender attributes) and text; participant messages are not possible (their tokens are receive-only).
5. Show the round timer (from `round_started` / polling) and the brief product name only after the buzzer (never the persona).
6. At the buzzer (event or status `ended`), show **Sold** / **Not sold** buttons → `POST /rounds/{roundId}/votes`. After voting (or `already_voted`), disable buttons and remember the vote locally.
7. The tally MUST always be visible after the buzzer and update from `tally` events and polling.
8. Round ended without a stage (late arrival) MUST show the tally, voting and a link to the replay page instead of video.
9. `cancelled` rounds MUST show "This round was cancelled".

## Technical Notes

- Reuse `useStage`, `useRoundEvents`, `parseRoundEvent` and `arenaPhase` from TASK-017.
- IVS Chat `tokenProvider` must return `{ token, sessionExpirationTime: new Date(...), tokenExpirationTime: new Date(...) }`.
- Votes are open from the buzzer forever, so the same voting component is reused on the replay page (TASK-019).

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `isValidNickname: should match backend rule (trim, 2–20, allowed chars)` | cases | `frontend/src/lib/validation.test.ts` |
| 2 | `tallyReducer: should apply tally events and ignore older polls` | state | `frontend/src/lib/votes.test.ts` |
| 3 | `votePercent: should handle zero votes` | 0/0 → 0% | `frontend/src/lib/votes.test.ts` |
| 4 | `rememberVote/getRememberedVote: should persist per round` | storage | `frontend/src/lib/storage.test.ts` |
| 5 | `liveRoundLabel: should describe ready vs live` | strings | `frontend/src/lib/rounds.test.ts` |

### GREEN — Implementation Order

1. Pure helpers (tests 1–5).
2. `components/LiveNow.tsx`, `ChatPanel.tsx`, `NicknameDialog.tsx`, `VotePanel.tsx`.
3. `app/watch/[roundId]/page.tsx`.

### REFACTOR

- Share `VotePanel` and `NicknameDialog` with TASK-019.

## Dependencies

- `TASK-017`, `TASK-010`, `TASK-011`

## Files to Create/Modify

- `frontend/src/lib/votes.ts`, `rounds.ts`, `validation.ts`, `storage.ts` (+ tests)
- `frontend/src/components/LiveNow.tsx`, `ChatPanel.tsx`, `NicknameDialog.tsx`, `VotePanel.tsx`
- `frontend/src/app/watch/[roundId]/page.tsx`
- `frontend/src/app/page.tsx` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; build, lint, typecheck clean
- [ ] User verifies: a third browser watches a live round, chats with a nickname and votes after the buzzer; the tally updates live

## Spec Updates

- [ ] None

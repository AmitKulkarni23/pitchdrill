# Task: 010 — Spectator chat tokens with nicknames

## Summary

Spectators chat during a round under a nickname they type once (stored in their browser). This task issues IVS Chat tokens that let them send messages, with the nickname attached. See `docs/system_specs/architecture.md` §3 (Chat) and §5.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 Chat, §8 Security
- `docs/system_specs/data_model.md` — Limits and Validation (`nickname`, `voterId`)

## Requirements

### Backend

1. `POST /rounds/{roundId}/chat-token` with `{ voterId, nickname }` MUST return `{ token, sessionExpirationTime, tokenExpirationTime }` from `CreateChatToken({ roomIdentifier: chatRoomArn, userId: "viewer-<voterId>", capabilities: ["SEND_MESSAGE"], attributes: { nickname }, sessionDurationInMinutes: 60 })`.
2. Allowed while the room exists: status `ready`, `live` or `ended`. Otherwise 409 `chat_closed`.
3. `nickname` MUST be trimmed and match the data model rule (2–20 chars, letters/numbers/spaces/`_-.`); `voterId` MUST be a UUID v4. Invalid → 400.
4. Nicknames MUST NOT impersonate participants: reject (409 `nickname_taken`) a nickname equal, case-insensitively, to the round's seller or buyer handle.
5. Route added to `routes.ts` with throttle 20/40.

### Infrastructure

6. Lambda with `table.grantReadData`; scoped `ivschat:CreateChatToken` on `room/*`.

## Technical Notes

- Reuse `requireVoterId` from TASK-009; add `requireNickname` to `lib/validation.ts` (also used by comments in TASK-012).
- The IVS Chat web SDK's `tokenProvider` expects exactly `{ token, sessionExpirationTime, tokenExpirationTime }` (Dates or ISO strings). Return ISO strings; the frontend converts.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `chatToken: should request SEND_MESSAGE token with nickname attribute` | mock args | `backend/test/chatToken.test.ts` |
| 2 | `chatToken: given closed round, should return chat_closed` | 409 | `backend/test/chatToken.test.ts` |
| 3 | `requireNickname: should trim and reject invalid characters/lengths` | cases | `backend/test/validation.test.ts` |
| 4 | `chatToken: given nickname equal to seller handle (any case), should return nickname_taken` | 409 | `backend/test/chatToken.test.ts` |

### GREEN — Implementation Order

1. `requireNickname` (test 3).
2. Handler (tests 1, 2, 4).
3. Route + CDK.

### REFACTOR

- None expected.

## Dependencies

- `TASK-009`

## Files to Create/Modify

- `backend/src/handlers/createChatToken.ts` (create)
- `backend/src/lib/validation.ts`, `backend/src/lib/ivs.ts`, `backend/src/routes.ts` (modify)
- `backend/test/chatToken.test.ts`, `backend/test/validation.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed

## Spec Updates

- [ ] None

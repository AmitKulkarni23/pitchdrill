# Task: 009 — Round details, briefs, join and watch tokens

## Summary

Give the frontend everything it needs around a live round: public round details, the list of live rounds, each side's own brief (from T-30s), participant stage tokens for ticket holders, and watch-only tokens for spectators. This is where a ticket becomes an IVS token. See `docs/system_specs/architecture.md` §5 and §6 ("Ticket → booking → round → stage token").

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §5 API, §6 Key Flows, §8 Security
- `docs/system_specs/data_model.md` — `META`, Limits and Validation
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `GET /rounds/{roundId}` MUST return `{ round: { roundId, slotId, status, sellerHandle, buyerHandle, startedAt?, endedAt?, cancelReason?, votesSold, votesNotSold, replayUrl? } }`. `replayUrl` = `https://${RECORDINGS_CDN_DOMAIN_ENV}/${recordingPath}` when `recordingPath` exists. MUST NOT include briefs, booking IDs or ARNs. Missing or `hidden` → 404 `round_not_found`.
2. `GET /rounds/live` MUST return `{ rounds: [...] }` (same public shape) for rounds of slots with `T - 5m ≤ now ≤ T + 5m` whose status is `ready` or `live`.
3. `GET /rounds/{roundId}/brief` (header `x-ticket`) MUST return `{ product, brief, role }` for the ticket's side only: seller → `briefs.seller`, buyer → `briefs.buyer`; both get `product`.
   - Ticket not for this round → 403 `not_your_round`.
   - `now < T - 30s` → 403 `brief_not_yet` with `availableAt` (ISO) in the error body.
   - Briefs missing → 503 `brief_pending`.
4. `POST /rounds/{roundId}/join` (header `x-ticket`) MUST, for the round's seller or buyer while status is `ready` or `live`, return:
   - `stageToken`: `CreateParticipantToken({ stageArn, userId: bookingId, attributes: { handle, role, order: seller "1" | buyer "2" }, capabilities: ["PUBLISH", "SUBSCRIBE"], duration: 30 })`
   - `chatToken`: `CreateChatToken({ roomIdentifier: chatRoomArn, userId: bookingId, capabilities: [], attributes: { nickname: handle, role }, sessionDurationInMinutes: 30 })` returned as `{ token, sessionExpirationTime, tokenExpirationTime }`
   - Other statuses → 409 `round_not_joinable` with the current `status`.
5. `POST /rounds/{roundId}/watch` with `{ voterId }` (UUID v4) MUST return `{ stageToken }` with `capabilities: ["SUBSCRIBE"]`, `userId: "viewer-<voterId>"`, `duration: 30`, while status is `ready` or `live`.
6. All new routes MUST be added to `backend/src/routes.ts` with throttles per `architecture.md` §3.

### Infrastructure

7. Lambdas get `table.grantReadData` (all) and env `RECORDINGS_CDN_DOMAIN_ENV` (round read/live).
8. IVS permissions (scoped `addToRolePolicy`): join + watch → `ivs:CreateParticipantToken` on `stage/*`; join → `ivschat:CreateChatToken` on `room/*`.
9. Alarm `pitchdrill-users-cannot-join-rounds` on ERROR logs of the join function.

## Technical Notes

- Reuse `getBookingByTicket`; compare `booking.roundId === roundId` and the role to find the side.
- Briefs are the only secret on `META`; build the public shape with an explicit allowlist function `toPublicRound(meta)`, never by deleting fields.
- The `userId = bookingId` convention is what TASK-007 checks with `ListParticipants`.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `toPublicRound: should never include briefs, booking IDs or ARNs` | allowlist | `backend/test/rounds.test.ts` |
| 2 | `getRound: given hidden round, should 404` | error code | `backend/test/rounds.test.ts` |
| 3 | `liveRounds: should list only ready/live rounds of the current slot` | filtering | `backend/test/rounds.test.ts` |
| 4 | `getBrief: seller should get seller brief, buyer should get buyer brief` | content per side | `backend/test/rounds.test.ts` |
| 5 | `getBrief: before T-30s, should return brief_not_yet with availableAt` | error | `backend/test/rounds.test.ts` |
| 6 | `getBrief: ticket from another round, should return not_your_round` | 403 | `backend/test/rounds.test.ts` |
| 7 | `join: should request PUBLISH+SUBSCRIBE token with userId bookingId and order attribute` | mock args | `backend/test/join.test.ts` |
| 8 | `join: given status ended, should return round_not_joinable` | 409 | `backend/test/join.test.ts` |
| 9 | `watch: should request SUBSCRIBE-only token for viewer-<voterId>` | mock args | `backend/test/join.test.ts` |
| 10 | `watch: given invalid voterId, should 400` | error | `backend/test/join.test.ts` |

### GREEN — Implementation Order

1. `lib/rounds.ts` (`getRoundMeta`, `toPublicRound`, `liveRounds`) — tests 1–3.
2. Brief handler — tests 4–6.
3. Token wrappers in `lib/ivs.ts`, join/watch handlers — tests 7–10.
4. Routes + CDK.

### REFACTOR

- Shared `requireVoterId(body)` validator for later tasks.

## Dependencies

- `TASK-006` (stages/rooms exist), `TASK-002` (routes registry)

## Files to Create/Modify

- `backend/src/lib/rounds.ts` (create), `backend/src/lib/ivs.ts` (modify), `backend/src/lib/validation.ts` (create)
- `backend/src/handlers/getRound.ts`, `listLiveRounds.ts`, `getBrief.ts`, `joinRound.ts`, `watchRound.ts` (create)
- `backend/src/routes.ts` (modify)
- `backend/test/rounds.test.ts`, `backend/test/join.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed; signed `GET /rounds/live` returns `{ rounds: [] }`

## Spec Updates

- [ ] None, unless response shapes changed (then update `architecture.md` §5)

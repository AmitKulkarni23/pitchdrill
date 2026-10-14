# Task: 011 — Votes with live tally

## Summary

After the buzzer, anyone can vote "Sold" or "Not sold", once per browser (`voterId`). The tally is always visible and is pushed live to everyone in the round's chat room while it exists. Votes stay open on replays forever. See `docs/system_specs/architecture.md` §3 (Votes) and `docs/system_specs/data_model.md` (Access Pattern 7).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 Votes, §9 Observability
- `docs/system_specs/data_model.md` — `VOTE#`, `META.votesSold/votesNotSold`

## Requirements

### Backend

1. `POST /rounds/{roundId}/votes` with `{ voterId, vote }` (`vote` ∈ `sold` | `not_sold`) MUST, in one transaction, put `ROUND#<id>` / `VOTE#<voterId>` with `attribute_not_exists(PK)` and `ADD votesSold|votesNotSold :1` on `META` with condition `status IN ("ended", "closed") AND attribute_not_exists(hidden)`.
2. Response: `{ votesSold, votesNotSold }` (read back with `ReturnValues` is not possible in a transaction; do a consistent `GetItem` after).
3. Already voted → 409 `already_voted` (include the current tally). Round not voteable (not ended/closed, hidden, missing) → 409 `voting_closed` or 404 `round_not_found`.
4. While `status = "ended"` (chat room still exists), MUST `sendRoundEvent(chatRoomArn, "tally", { sold, notSold })`. Failure to send MUST be logged at WARN and MUST NOT fail the vote.
5. Emit `VoteCast` metric.
6. Route in `routes.ts` with throttle 20/40.

### Infrastructure

7. Lambda with `table.grantReadWriteData`; scoped `ivschat:SendEvent` on `room/*`.
8. Alarm `pitchdrill-users-cannot-vote` on ERROR logs of the vote function.

## Technical Notes

- Read the transaction cancellation reasons by index to distinguish "already voted" (index 0) from "not voteable" (index 1).
- Tally attribute names in the chat event are strings (`"12"`); the frontend parses them.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `castVote: given an ended round, should record vote and return tally` | tally 1/0 | `backend/test/votes.test.ts` |
| 2 | `castVote: same voter twice, should return already_voted with tally` | 409 + counts unchanged | `backend/test/votes.test.ts` |
| 3 | `castVote: given a live round, should return voting_closed` | 409 | `backend/test/votes.test.ts` |
| 4 | `castVote: given hidden round, should not count` | rejected | `backend/test/votes.test.ts` |
| 5 | `castVote: given status ended, should send tally event` | SendEvent args | `backend/test/votes.test.ts` |
| 6 | `castVote: given SendEvent failure, should still succeed` | 200 | `backend/test/votes.test.ts` |
| 7 | `castVote: 10 concurrent voters, should count 10` | final tally | `backend/test/votes.test.ts` |

### GREEN — Implementation Order

1. `lib/votes.ts` (tests 1–4, 7).
2. Event broadcast (tests 5–6).
3. Handler, route, CDK.

### REFACTOR

- None expected.

## Dependencies

- `TASK-008` (rounds reach `ended`), `TASK-009` (`requireVoterId`)

## Files to Create/Modify

- `backend/src/lib/votes.ts`, `backend/src/handlers/castVote.ts` (create)
- `backend/src/routes.ts` (modify)
- `backend/test/votes.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed

## Spec Updates

- [ ] None

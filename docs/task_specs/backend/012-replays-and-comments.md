# Task: 012 — Replay feed and comments

## Summary

List recent replays (newest first) and let people comment on a round after it ends. Comments use the same nickname as chat. See `docs/system_specs/data_model.md` (GSI1, `COMMENT#`, Access Patterns 8–9) and `docs/system_specs/architecture.md` §5.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §5 API, §8 Security
- `docs/system_specs/data_model.md` — GSI1, Round partition, Limits and Validation

## Requirements

### Backend

1. `GET /replays?cursor=<c>` MUST query `GSI1` (`GSI1PK = "REPLAY"`, newest first, `Limit 20`) and return `{ replays: [publicRound...], nextCursor? }` using `toPublicRound` (TASK-009). `cursor` is base64url JSON of `LastEvaluatedKey`; an invalid cursor → 400 `bad_cursor`.
2. `GET /rounds/{roundId}/comments?cursor=<c>` MUST return `{ comments: [{ commentId, nickname, text, createdAt }], nextCursor? }` oldest first, `Limit 50`. MUST NOT return `voterId`. Hidden/missing round → 404.
3. `POST /rounds/{roundId}/comments` with `{ voterId, nickname, text }` MUST validate (`requireVoterId`, `requireNickname`, `text` trimmed 1–500), require status `ended` or `closed` and not hidden, and write `COMMENT#<createdAt>#<commentId>`. Returns `{ comment }` (201).
4. Nicknames equal to the round's seller/buyer handle (case-insensitive) MUST be rejected with `nickname_taken` (same rule as chat).
5. Routes in `routes.ts`: reads 20/40, comment POST 20/40.

### Infrastructure

6. Lambdas: replays + comment list → `table.grantReadData`; comment create → `table.grantReadWriteData`; replays needs `RECORDINGS_CDN_DOMAIN_ENV`.

## Technical Notes

- Querying a GSI needs `IndexName: "GSI1"`; `grantReadData` covers `table/index/*` with `TableV2`; confirm in the synthesized policy.
- Cursor helpers (`encodeCursor`, `decodeCursor`) go in `lib/pagination.ts`; validate the decoded object has only string values for expected keys.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `listReplays: should return newest first and paginate with cursor` | order + nextCursor | `backend/test/replays.test.ts` |
| 2 | `listReplays: should exclude hidden rounds` | absent (no GSI keys) | `backend/test/replays.test.ts` |
| 3 | `decodeCursor: given garbage, should throw bad_cursor` | 400 | `backend/test/pagination.test.ts` |
| 4 | `createComment: given ended round, should store and return comment` | item + response | `backend/test/comments.test.ts` |
| 5 | `createComment: given live round, should reject` | 409 `comments_closed` | `backend/test/comments.test.ts` |
| 6 | `createComment: given 501 chars, should 400` | validation | `backend/test/comments.test.ts` |
| 7 | `listComments: should be oldest first and omit voterId` | shape | `backend/test/comments.test.ts` |

### GREEN — Implementation Order

1. Pagination helpers (test 3).
2. Replays (tests 1–2).
3. Comments (tests 4–7).
4. Routes + CDK.

### REFACTOR

- None expected.

## Dependencies

- `TASK-008` (replays get GSI keys), `TASK-009`, `TASK-010` (validation)

## Files to Create/Modify

- `backend/src/lib/pagination.ts`, `backend/src/lib/comments.ts` (create)
- `backend/src/handlers/listReplays.ts`, `listComments.ts`, `createComment.ts` (create)
- `backend/src/routes.ts` (modify)
- `backend/test/replays.test.ts`, `pagination.test.ts`, `comments.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed; signed `GET /replays` returns `{ replays: [] }`

## Spec Updates

- [ ] None

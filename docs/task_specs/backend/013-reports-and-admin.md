# Task: 013 — Reports and IAM-only admin routes

## Summary

Anyone can report a round. The owner moderates with IAM-signed requests (no admin UI): list recent reports, end a live round immediately, and hide a replay. Admin routes stay IAM-only even after the public API is opened in TASK-021. See `docs/system_specs/architecture.md` §3 (Moderation) and §5.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 Moderation, §5 API
- `docs/system_specs/data_model.md` — `REPORT#`, `REPORTS` partition, `hidden`
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `POST /rounds/{roundId}/reports` with `{ voterId, reason }` (reason trimmed 1–300) MUST write, in one transaction, `ROUND#<id>` / `REPORT#<createdAt>#<reportId>` and `REPORTS` / `<createdAt>#<roundId>#<reportId>`. One report per `voterId` per round (conditional on a `REPORTER#<voterId>` guard item in the round partition) → 409 `already_reported`. Returns 201 `{ reported: true }`. Allowed for any existing round.
2. `GET /admin/reports?cursor=` MUST list `REPORTS` newest first (`Limit 50`) with `roundId`, `reason`, `createdAt`, plus each round's `status` and handles.
3. `POST /admin/rounds/{roundId}/end` MUST call `endRound(round, { endedBy: "admin" })` from TASK-008 for a `live` round; for `ready`, cancel with `cancelReason: "admin"` (delete stage + room); otherwise 409 `round_not_active`.
4. `POST /admin/rounds/{roundId}/hide` MUST `SET hidden = true` and `REMOVE GSI1PK, GSI1SK` on `META`. Idempotent.
5. All three admin routes MUST be `auth: "iam"` in `routes.ts`.

### Infrastructure

6. Admin routes use `HttpIamAuthorizer` explicitly (already handled by the route loop from TASK-002).
7. End-round Lambda needs the same IVS permissions as `endRound` uses (`ivs:StopComposition`, `ivs:DeleteStage`, `ivschat:SendEvent`, `ivschat:DeleteRoom`), scoped as in TASK-006/008.
8. Report throttle 5/10.

## Technical Notes

- `endRound` and the cancel path must be importable without pulling the scheduler handler; if needed, move them to `backend/src/lib/lifecycle.ts`.
- Signed call example (record in `CLAUDE.md`):
  `curl --aws-sigv4 "aws:amz:us-west-2:execute-api" --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" -H "x-amz-security-token: $AWS_SESSION_TOKEN" -X POST <api>/admin/rounds/<id>/hide`

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `reportRound: should write round report and REPORTS index` | both items | `backend/test/reports.test.ts` |
| 2 | `reportRound: same voter twice, should return already_reported` | 409 | `backend/test/reports.test.ts` |
| 3 | `listReports: should be newest first with round status` | order + fields | `backend/test/reports.test.ts` |
| 4 | `adminEnd: given live round, should end it with endedBy admin` | META | `backend/test/admin.test.ts` |
| 5 | `adminEnd: given ready round, should cancel with reason admin` | META + deletes | `backend/test/admin.test.ts` |
| 6 | `adminHide: should set hidden and remove GSI keys` | META | `backend/test/admin.test.ts` |
| 7 | `routes: admin routes should all be auth iam` | registry | `backend/test/routes.test.ts` |

### GREEN — Implementation Order

1. Reports (tests 1–3).
2. Admin end/hide (tests 4–6).
3. Registry (test 7), CDK.

### REFACTOR

- None expected.

## Dependencies

- `TASK-008` (`endRound`), `TASK-012` (pagination)

## Files to Create/Modify

- `backend/src/lib/reports.ts` (create), `backend/src/lib/lifecycle.ts` (create or modify)
- `backend/src/handlers/reportRound.ts`, `adminListReports.ts`, `adminEndRound.ts`, `adminHideRound.ts` (create)
- `backend/src/routes.ts` (modify)
- `backend/test/reports.test.ts`, `admin.test.ts` (create), `routes.test.ts` (modify)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `cdk diff` reviewed, deployed; signed `GET /admin/reports` returns `{ reports: [] }`

## Spec Updates

- [ ] Update `CLAUDE.md` — signed admin curl examples

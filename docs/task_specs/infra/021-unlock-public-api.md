# Task: 021 — Open the API to the public (REQUIRES USER APPROVAL)

## Summary

Until now every API route has required IAM-signed requests so nothing is exposed while testing. This task opens the public routes to browsers on the Vercel domain, keeps admin routes IAM-only, and runs an end-to-end smoke test in production. **Do not deploy this change until the user explicitly approves it in the current session.** See `docs/system_specs/architecture.md` §3 (API exposure, CORS).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md` — IAM lock notes under Commands → Infra
- `docs/system_specs/architecture.md` — §3, §5 (auth column)
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Approval

1. Before editing, **STOP and ask the user**: "Open the public API now?" and the production Vercel domain to allow. Proceed only on an explicit yes.

### Infrastructure

2. Remove `defaultAuthorizer: new HttpIamAuthorizer()` from the API. Routes with `auth: "public"` MUST use no authorizer; `auth: "iam"` routes MUST keep `HttpIamAuthorizer`.
3. `ALLOWED_ORIGINS` MUST add the production Vercel domain (`https://<domain>`), applied to API CORS and the CloudFront response headers policy. Do not add wildcard origins.
4. `cdk diff` MUST show only authorization changes on public routes and CORS updates; show the diff to the user before deploying.

### Verification (production)

5. Anonymous `GET /slots` → 200; anonymous `GET /admin/reports` → 403; signed `GET /admin/reports` → 200.
6. CORS preflight from the Vercel origin → allowed; from another origin → no `access-control-allow-origin`.
7. With the user, run one real round end-to-end on the deployed site (two devices + one spectator): book, pair, briefs, arena, buzzer, votes, replay. Then hide the test round with the admin route if the user wants it gone.

## Technical Notes

- Once open, throttles are the only abuse protection (all users combined, not per IP). Mention this to the user again when asking for approval.
- Update the frontend env on Vercel if the API URL changed (it should not).

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `stack: public routes should have AuthorizationType NONE` | each public route | `infra/test/backend-stack.test.ts` |
| 2 | `stack: admin routes should have AuthorizationType AWS_IAM` | each admin route | `infra/test/backend-stack.test.ts` |
| 3 | `stack: CORS should allow localhost and the Vercel domain only` | origins | `infra/test/backend-stack.test.ts` |

### GREEN — Implementation Order

1. Approval (requirement 1).
2. Stack change (tests 1–3), diff, user sees diff, deploy.
3. Verification steps 5–7.

### REFACTOR

- None expected.

## Dependencies

- `TASK-013`, `TASK-019`, `TASK-020`

## Files to Create/Modify

- `infra/lib/backend-stack.ts` (modify)
- `infra/test/backend-stack.test.ts` (modify)
- `CLAUDE.md` (modify — remove "Currently locked to IAM", document admin-only IAM)

## Acceptance Criteria

- [ ] User approved in-session
- [ ] All RED tests written and failing for the right reason; then GREEN
- [ ] Deployed; verification 5–7 passed

## Spec Updates

- [ ] Update `docs/system_specs/architecture.md` §3 — API exposure: public routes open, admin IAM-only
- [ ] Update `CLAUDE.md` — lock notes

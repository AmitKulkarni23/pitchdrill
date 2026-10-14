# Task: 020 — Vercel deployment from Git

## Summary

The Vercel project already exists and builds: project `pitchdrill` in scope `amits-projects-684cec17`, root directory `frontend`, framework Next.js, install `bun install`, build `bun run build`, Node 24.x, `NEXT_PUBLIC_API_URL` set for production and preview, and Vercel Authentication on all deployments except custom domains (none exist), so nothing is public. A CLI deploy (`vercel deploy`) reached Ready and redirects anonymous visitors to Vercel login. What is missing is the Git connection, so pushes to GitHub deploy automatically. See `docs/system_specs/architecture.md` §1.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md` — Commands → Vercel
- `docs/system_specs/architecture.md` — §1 System Context, §3 (API exposure)

## Requirements

### User action (hard stop)

1. **Ask the user** to give the Vercel GitHub app access to `AmitKulkarni23/pitchdrill` (GitHub → Settings → Applications → Vercel → Configure → Repository access → add `pitchdrill`). `vercel git connect` failed with "Failed to connect AmitKulkarni23/pitchdrill to project" because the app cannot see the private repo.

### Connection

2. From the repo root (linked via `vercel link --project pitchdrill`), run `vercel git connect --yes`.
3. Pushing to `master` MUST trigger a production deployment, and pushing other branches MUST trigger preview deployments.
4. Deployment protection MUST stay `all_except_custom_domains` (`vercel project protection pitchdrill --json`). Do not add a custom domain until TASK-021.

### Verification

5. Push a trivial commit (e.g. a doc fix) and confirm a new deployment appears in `vercel ls pitchdrill` with source Git and status Ready.
6. Anonymous `curl -I` to the deployment URL MUST return a redirect to `vercel.com/sso-api` (not 200).

## Technical Notes

- `pitchdrill.vercel.app` belongs to an unrelated site; our production URL is `pitchdrill-amits-projects-684cec17.vercel.app` (protected).
- The deployed site calls the IAM-locked API, so the guide renders from the local slot rules and booking shows "Booking isn't open to the public yet" until TASK-021. The API's CORS also does not yet allow the Vercel origin (TASK-021 adds it).

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | n/a (infrastructure wiring, verified by requirements 5–6) | — | — |

### GREEN — Implementation Order

1. User grants repo access.
2. `vercel git connect`.
3. Verification push.

### REFACTOR

- None expected.

## Dependencies

- `TASK-014`

## Files to Create/Modify

- `CLAUDE.md` (modify — Vercel section: project name, protection, Git auto-deploy)

## Acceptance Criteria

- [ ] User granted the Vercel GitHub app access to the repo
- [ ] Git connected; a push produced a Ready deployment from Git
- [ ] Anonymous requests redirect to Vercel login

## Spec Updates

- [ ] Update `CLAUDE.md` — Vercel commands and protection notes

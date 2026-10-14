# Task: 002 — Route registry and local dev server

## Summary

Routes are currently listed by hand in the CDK stack. Declare them once in `backend/src/routes.ts`, have the stack build Lambdas, routes and throttles from that list, and add a Bun dev server that serves the same routes on `localhost:4000` against DynamoDB Local. The frontend develops against this server while the deployed API stays IAM-locked. See `docs/system_specs/architecture.md` §5 and §7.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §5 API, §7 Local Development
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `backend/src/routes.ts` MUST export `routes: { method: "GET" | "POST"; path: string; handler: string; auth: "public" | "iam"; throttle?: { rateLimit: number; burstLimit: number } }[]`. `handler` is the file name in `src/handlers/` without extension (e.g. `"createBooking"`). `path` uses API Gateway syntax (`/rounds/{roundId}`).
2. The registry MUST contain the three existing routes with their current throttles.
3. `backend/src/dev/server.ts` MUST serve every registry route with `Bun.serve` on port 4000 (`PORT` env overrides), converting each request into an `APIGatewayProxyEventV2` (lowercased `headers`, `body`, `queryStringParameters`, `pathParameters`, `requestContext.http.method`, `rawPath`) and calling the handler with a fake `Context`.
4. The dev server MUST answer CORS preflight and add CORS headers for `http://localhost:3000` (allow headers `content-type`, `x-ticket`).
5. The dev server MUST ignore `auth` (local only) and MUST return 404 `{ error: { code: "not_found" } }` for unknown routes.
6. `backend/src/dev/localTable.ts` MUST export `createLocalTable()` that (re)creates `pitchdrill-main` in DynamoDB Local with `PK`/`SK` and `GSI1` (`GSI1PK`/`GSI1SK`, projection ALL). Tests MUST use it instead of their inline `CreateTableCommand`.
7. `backend/package.json` MUST add `"dev"` (runs the server with DynamoDB Local env vars, as `test:local` does) and `"dev:table"` (creates the local table).
8. Dev files MUST NOT be bundled into Lambdas (the build only bundles `src/handlers/*.ts`; keep it that way).

### Infrastructure

9. The stack MUST create Lambdas, integrations, routes and `routeSettings` throttles by looping over `routes`.
10. Construct IDs, function names and log group names MUST stay identical (`PitchDrill<Handler>` with the first letter upper-cased) so `cdk diff` shows **no** replacements.
11. Routes with `auth: "iam"` MUST explicitly use `HttpIamAuthorizer`; public routes inherit the stack default (currently the IAM lock, removed in TASK-021).
12. Table grants stay per function; keep them explicit next to the loop (a small map from handler name to grant), not in `routes.ts`.

## Technical Notes

- `infra` imports `../../backend/src/routes` directly; it is plain data with no runtime dependencies.
- Path matching: convert `/rounds/{roundId}` into a regex once at startup; put matched names into `pathParameters`.
- `POST /dev/tick` is added in TASK-006, not here.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `matchRoute: given /rounds/abc, should match /rounds/{roundId} with roundId abc` | match + params | `backend/test/devServer.test.ts` |
| 2 | `matchRoute: given unknown path or wrong method, should return undefined` | no match | `backend/test/devServer.test.ts` |
| 3 | `toEvent: should lowercase headers and parse query string` | event fields | `backend/test/devServer.test.ts` |
| 4 | `dev server: GET /slots should return 200 with CORS header for localhost:3000` | status + header | `backend/test/devServer.test.ts` |
| 5 | `dev server: OPTIONS preflight should return 204 with allowed headers` | headers | `backend/test/devServer.test.ts` |
| 6 | `routes: every handler name should have a file in src/handlers` | registry ↔ files | `backend/test/routes.test.ts` |

### GREEN — Implementation Order

1. `routes.ts` + test 6.
2. `dev/server.ts` exporting `matchRoute`, `toEvent`, and a `startServer(port)` (tests 1–5).
3. `dev/localTable.ts`; switch tests to it.
4. Refactor the stack to loop over `routes`; `cdk diff` must show no replacements.

### REFACTOR

- None expected.

## Dependencies

- `TASK-001` — the stack and tests it changes

## Files to Create/Modify

- `backend/src/routes.ts` (create)
- `backend/src/dev/server.ts` (create)
- `backend/src/dev/localTable.ts` (create)
- `backend/test/devServer.test.ts`, `backend/test/routes.test.ts` (create)
- `backend/test/bookings.test.ts`, `backend/test/slotStats.test.ts` (modify — use `createLocalTable`)
- `backend/package.json` (modify — scripts)
- `infra/lib/backend-stack.ts` (modify — loop over routes)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] `bun run dev` serves `GET /slots` on `localhost:4000` against DynamoDB Local
- [ ] `cdk diff` shows no resource replacements; deployed if anything changed

## Spec Updates

- [ ] Update `CLAUDE.md` Commands — add `bun run dev:table` and `bun run dev`

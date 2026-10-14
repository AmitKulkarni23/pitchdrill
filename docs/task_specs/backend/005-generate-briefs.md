# Task: 005 — Generate briefs with OpenRouter

## Summary

When a round is paired, generate a random product with a seller sheet and a hidden buyer persona via OpenRouter, and store it on the round. A DynamoDB stream triggers `GenerateBriefs` on every new round `META`. If generation fails, `SlotTick` (TASK-006) retries and finally falls back to a hand-written product list, so a round never starts without briefs. Replaces the stub in `backend/src/lib/briefs.ts`. See `docs/system_specs/architecture.md` §3 (Briefs) and §4.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §3 Briefs, §8 Security, §9 Observability
- `docs/system_specs/data_model.md` — `META.briefs`
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. `generateBriefs(): Promise<Briefs>` MUST call `POST https://openrouter.ai/api/v1/chat/completions` with `model = process.env.OPENROUTER_MODEL_ENV`, the API key from Secrets Manager (`OPENROUTER_SECRET_ARN_ENV`, cached per container), `response_format: { type: "json_object" }`, and a 20-second timeout (`AbortSignal.timeout`).
2. The prompt MUST ask for one random, safe-for-work, plausible product (consumer or B2B) and return JSON: `{ product: { name, price, tagline }, seller: string, buyer: string }`. `seller` is a ≤120-word product sheet; `buyer` is a ≤120-word persona: who they are, budget, current solution, 2–3 objections, what could change their mind.
3. The response MUST be validated (all fields non-empty strings, sensible lengths). Invalid or failed responses MUST be retried once, then throw.
4. `fallbackBriefs(): Briefs` MUST return a random entry from at least 10 hand-written products in `backend/src/lib/fallbackBriefs.ts`, with `source: "fallback"`. Generated briefs carry `source: "openrouter"`.
5. `handlers/generateBriefs.ts` MUST process DynamoDB stream records for `INSERT` of `SK = META`, call `generateBriefs`, and `UpdateItem SET briefs = :b` with `ConditionExpression: attribute_not_exists(briefs)`.
6. Failures MUST be logged and counted (`BriefGenerationFailed` metric) but MUST NOT throw (no stream retries pile-up; `SlotTick` retries). Success emits `BriefGenerated`.
7. The API key MUST never be logged.

### Infrastructure

8. Lambda `PitchDrillGenerateBriefs` (Node.js 24, arm64, 60 s timeout, 1-month log group, tracing) with `DynamoEventSource` on the table stream, `startingPosition: LATEST`, `batchSize: 10`, `retryAttempts: 0`, filter `eventName = INSERT` and `dynamodb.Keys.SK.S = META`.
9. Grants: `secret.grantRead(fn)`, `table.grantWriteData(fn)`. Env: `TABLE_NAME_ENV`, `OPENROUTER_SECRET_ARN_ENV`, `OPENROUTER_MODEL_ENV`.

## Technical Notes

- Add `@aws-sdk/client-secrets-manager` as a dependency (external in the bundle; the Lambda runtime provides it).
- Mock `fetch` with `spyOn(globalThis, "fetch")` and Secrets Manager with `mock.module` in tests; never call OpenRouter from tests.
- OpenRouter may wrap JSON in code fences for some models; strip them before `JSON.parse`.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `generateBriefs: given a valid response, should return briefs with source openrouter` | parsed shape | `backend/test/briefs.test.ts` |
| 2 | `generateBriefs: should send model and bearer key` | request body + header | `backend/test/briefs.test.ts` |
| 3 | `generateBriefs: given invalid JSON then valid, should retry once and succeed` | 2 fetch calls | `backend/test/briefs.test.ts` |
| 4 | `generateBriefs: given two failures, should throw` | rejects | `backend/test/briefs.test.ts` |
| 5 | `fallbackBriefs: should return a complete brief with source fallback` | shape | `backend/test/briefs.test.ts` |
| 6 | `generateBriefs handler: given META insert, should store briefs once` | item updated; second run no-op | `backend/test/generateBriefsHandler.test.ts` |
| 7 | `generateBriefs handler: given generation failure, should not throw` | resolves, no briefs | `backend/test/generateBriefsHandler.test.ts` |

### GREEN — Implementation Order

1. `fallbackBriefs.ts` (test 5).
2. `briefs.ts` (tests 1–4).
3. Stream handler (tests 6–7).
4. CDK Lambda + event source.

### REFACTOR

- None expected.

## Dependencies

- `TASK-001` — round `META` item
- `TASK-004` — stream, secret, model constant

## Files to Create/Modify

- `backend/src/lib/briefs.ts` (replace stub)
- `backend/src/lib/fallbackBriefs.ts` (create)
- `backend/src/handlers/generateBriefs.ts` (create)
- `backend/test/briefs.test.ts`, `backend/test/generateBriefsHandler.test.ts` (create)
- `backend/package.json` (modify — dependency)
- `infra/lib/backend-stack.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; typecheck clean
- [ ] Deployed; the stream event source mapping is `Enabled` (`aws lambda list-event-source-mappings --function-name PitchDrillGenerateBriefs --region us-west-2`). No test data is written to the production table; end-to-end is verified in TASK-021
- [ ] Key never appears in logs

## Spec Updates

- [ ] None

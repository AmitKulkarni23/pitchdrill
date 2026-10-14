# Task: 004 — Replay GSI, table stream and OpenRouter secret

## Summary

Add the remaining data infrastructure for phase 2: the `GSI1` index for the replay feed, a DynamoDB stream that will trigger brief generation, and the Secrets Manager secret plus model setting for OpenRouter. See `docs/system_specs/data_model.md` (GSI1) and `docs/system_specs/architecture.md` §3 (Briefs).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/data_model.md` — GSI1
- `docs/system_specs/architecture.md` — §3 Decisions (Briefs)
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Infrastructure

1. The table MUST get a global secondary index `GSI1` (partition `GSI1PK` string, sort `GSI1SK` string, projection ALL).
2. The table MUST enable a stream with `NEW_IMAGE`.
3. A Secrets Manager secret `pitchdrill/openrouter-api-key` MUST be created with a placeholder value and `RemovalPolicy.RETAIN`. The real key MUST NOT appear in code, chat, or Git.
4. The OpenRouter model ID MUST be a single constant in the stack (`OPENROUTER_MODEL`), later passed to Lambdas as `OPENROUTER_MODEL_ENV`.
5. **STOP and ask the user** which OpenRouter model ID to use before setting the constant. Do not pick one.
6. After deploy, **ask the user** to set the key themselves (so it never enters the conversation):
   `! aws secretsmanager put-secret-value --region us-west-2 --secret-id pitchdrill/openrouter-api-key --secret-string '<key>'`

### Tests

7. Assertion tests MUST cover the GSI, the stream and the secret.

## Technical Notes

- DynamoDB allows only one GSI creation per table update; this task adds exactly one.
- `TableV2`: use `globalSecondaryIndexes` and `dynamoStream: StreamViewType.NEW_IMAGE`.
- Use `secretsmanager.Secret` with `secretStringValue: SecretValue.unsafePlainText('set-me')` for the placeholder. That is the only acceptable "unsafe" use: it is a placeholder, not a secret.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `stack: table should have GSI1 with ALL projection` | GSI definition | `infra/test/backend-stack.test.ts` |
| 2 | `stack: table should stream NEW_IMAGE` | stream spec | `infra/test/backend-stack.test.ts` |
| 3 | `stack: OpenRouter secret should exist and be retained` | secret name + DeletionPolicy Retain | `infra/test/backend-stack.test.ts` |

### GREEN — Implementation Order

1. GSI + stream (tests 1–2).
2. Secret + model constant after asking the user (test 3).

### REFACTOR

- None expected.

## Dependencies

- `TASK-003` — introduces infra tests

## Files to Create/Modify

- `infra/lib/backend-stack.ts` (modify)
- `infra/test/backend-stack.test.ts` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN
- [ ] User chose the model ID; constant set
- [ ] `cdk diff` reviewed (table update, no replacement), deployed
- [ ] User confirmed the secret value is set

## Spec Updates

- [ ] Update `docs/system_specs/architecture.md` §3 — record the chosen model ID

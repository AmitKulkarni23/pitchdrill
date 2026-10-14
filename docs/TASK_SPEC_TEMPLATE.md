# Task: <NNN> — <concise title>

## Summary

[One paragraph: what to build and why. Reference the relevant section of `docs/system_specs/architecture.md` or `docs/system_specs/data_model.md`.]

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md` — project rules, commands, Git conventions
- `docs/system_specs/architecture.md` — [specific section]
- `docs/system_specs/data_model.md` — [specific section]
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md` — for any change under `infra/`

## Requirements

[Numbered, RFC 2119 keywords (MUST/SHOULD/MAY). Group by concern if needed.]

### [Concern 1, e.g., Backend]

1. The handler MUST ...
2. The response SHOULD ...

### [Concern 2, e.g., Infrastructure]

3. The CDK stack MUST ...

## Technical Notes

[Key decisions, constraints, or gotchas. Keep brief. Only include what prevents wrong turns.]

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `functionName: given <condition>, should <behavior>` | expected outcome | `backend/test/...` |
| 2 | ... | ... | ... |

### GREEN — Implementation Order

1. Create X to make tests 1-3 pass
2. Create Y to make tests 4-5 pass

### REFACTOR

- [What to clean up after green, e.g., extract shared validation]
- [Or "None expected" if the task is simple]

## Dependencies

- `TASK-NNN` — [reason] (or "None")

## Files to Create/Modify

- `backend/src/handlers/<name>.ts` (create)
- `backend/test/<name>.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify — add route + permissions)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN with minimal implementation
- [ ] REFACTOR pass complete, no regressions
- [ ] [Criteria mapping to each requirement above]

## Spec Updates

- [ ] Update `docs/system_specs/<file>.md` — [what changed]
- [ ] [Or "None" if no spec changes needed]

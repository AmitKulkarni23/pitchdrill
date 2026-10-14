# Task: 019 — Replay page, comments, reports and replay feed

## Summary

Every finished round gets a replay page: the split-screen recording, the vote tally with voting still open, comments, and a report button. The home page lists recent replays. See `docs/system_specs/architecture.md` §5 and `docs/system_specs/data_model.md` (GSI1, comments).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §5 (`/replays`, comments, reports, `GET /rounds/{roundId}`)
- `docs/system_specs/data_model.md` — Limits and Validation

## Requirements

### Frontend

1. `/r/[roundId]` MUST load `GET /rounds/{roundId}`. 404 → "This replay isn't available".
2. With `replayUrl`, play the HLS recording: native HLS where `video.canPlayType("application/vnd.apple.mpegurl")`, otherwise `hls.js` (exact version, dynamically imported). Without `replayUrl` yet, show "Replay is processing" and re-check every 30 s.
3. Show "@seller vs @buyer", date, and `VotePanel` (TASK-018) with voting open.
4. Comments: list via `GET /rounds/{roundId}/comments` (oldest first, "Load more" with `nextCursor`); form with nickname (shared `NicknameDialog`) and text (1–500, counter). Post via `POST /rounds/{roundId}/comments` and append on success. Inline errors.
5. **Report** button → dialog with reason (1–300) → `POST /rounds/{roundId}/reports` with `voterId`; show "Thanks, we'll take a look" or `already_reported`.
6. Home MUST show "Recent replays" from `GET /replays` with "Load more" (`nextCursor`): handles, date, tally, link to `/r/[roundId]`.
7. Cancelled rounds MUST show "This round was cancelled" with no video.

## Technical Notes

- Merge paginated pages with a pure `appendPage(existing, page)` that de-duplicates by ID.
- CloudFront CORS (TASK-003) allows `localhost:3000`; the Vercel origin is added in TASK-021.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `appendPage: should append and de-duplicate by id` | result | `frontend/src/lib/pagination.test.ts` |
| 2 | `isValidComment: should trim and enforce 1–500` | cases | `frontend/src/lib/validation.test.ts` |
| 3 | `isValidReason: should trim and enforce 1–300` | cases | `frontend/src/lib/validation.test.ts` |
| 4 | `replayState: should map round to playing / processing / cancelled / unavailable` | state | `frontend/src/lib/replay.test.ts` |

### GREEN — Implementation Order

1. Pure helpers (tests 1–4).
2. `components/ReplayPlayer.tsx`, `Comments.tsx`, `ReportDialog.tsx`, `RecentReplays.tsx`.
3. `app/r/[roundId]/page.tsx`; home section.

### REFACTOR

- None expected.

## Dependencies

- `TASK-018`, `TASK-012`, `TASK-013`

## Files to Create/Modify

- `frontend/src/lib/pagination.ts`, `replay.ts`, `validation.ts` (+ tests)
- `frontend/src/components/ReplayPlayer.tsx`, `Comments.tsx`, `ReportDialog.tsx`, `RecentReplays.tsx`
- `frontend/src/app/r/[roundId]/page.tsx`, `frontend/src/app/page.tsx` (modify)
- `frontend/package.json` (modify — hls.js)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; build, lint, typecheck clean
- [ ] User verifies a replay plays in Chrome and Safari, comments post, report submits

## Spec Updates

- [ ] None

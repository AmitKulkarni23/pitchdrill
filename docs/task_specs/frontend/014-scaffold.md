# Task: 014 — Scaffold the Next.js frontend

## Summary

Create the Next.js (App Router) app in `frontend/` with Bun, MUI, a typed API client, browser storage helpers and a minimal neutral theme. Every later frontend task builds on this. The visual identity is decided later (`DESIGN.md`); do not invent a brand. See `CLAUDE.md` (Folder Structure, Tech Stack) and `docs/system_specs/architecture.md` §3, §7.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md` — Folder Structure, Tech Stack, Browser Automation
- `docs/system_specs/architecture.md` — §5 API (response shapes), §7 Local Development

## Requirements

### Frontend

1. Create the app with `bunx create-next-app@<latest stable> frontend --ts --app --src-dir --eslint --no-tailwind --use-bun --import-alias "@/*"`. Pin exact versions in `package.json` (no `latest`).
2. Folder layout MUST match `CLAUDE.md`: `src/app`, `src/components`, `src/config`, `src/types`, `src/lib`, `public`.
3. MUI MUST be installed (`@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/material-nextjs`) and wired with `AppRouterCacheProvider` + `ThemeProvider` + `CssBaseline` in the root `layout.tsx`. Components use `sx` props; no CSS Modules, no Tailwind.
4. `src/config/theme.ts` MUST define a minimal neutral MUI theme (system font stack, default palette, light + dark via `colorSchemes`). No brand colors or custom fonts.
5. `src/config/env.ts` MUST export `API_URL` from `NEXT_PUBLIC_API_URL` and throw a clear error at startup if it is missing.
6. `src/lib/api.ts` MUST export a typed client: `api.get<T>(path, { ticket? })`, `api.post<T>(path, body, { ticket? })`. It sets `content-type`, sends `x-ticket` when given, parses JSON, and throws `ApiError { status, code, message, details }` for `{ error }` responses and a generic `ApiError` (code `network`) when `fetch` fails.
7. `src/types/api.ts` MUST define the response types from `architecture.md` §5 (`Booking`, `PublicRound`, `SlotWithStats`, …). Keep them in sync manually (ponytail: shared package if they drift).
8. `src/lib/storage.ts` MUST wrap `localStorage` in try/catch for: `getVoterId()` (creates a UUID v4 once), `getNickname()/setNickname()`, `getTickets()/addTicket(ticket)` (list of raw tickets this browser booked). All functions MUST work (return defaults) when storage is unavailable.
9. The home page MUST render a placeholder ("PitchDrill — schedule coming soon") using MUI components.
10. `.env.development.local` (gitignored) MUST set `NEXT_PUBLIC_API_URL=http://localhost:4000` (the backend dev server from TASK-002).
11. Scripts: `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`bun test src`).

### Tests

12. Unit tests with `bun test` for pure logic in `src/lib` only (no DOM rendering tests).

## Technical Notes

- Do not run browser automation (`CLAUDE.md`). Verify with `bun run build`, `lint`, `typecheck`, `test`; the user checks the UI.
- Root `.gitignore` already ignores `.env*`, `.next/`, `node_modules/`.
- In tests, stub `globalThis.localStorage` (including one that throws) rather than adding a DOM library.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `api.get: given { error } response, should throw ApiError with code and status` | error fields | `frontend/src/lib/api.test.ts` |
| 2 | `api.get: given ticket, should send x-ticket header` | fetch args | `frontend/src/lib/api.test.ts` |
| 3 | `api.post: given fetch rejection, should throw ApiError network` | code | `frontend/src/lib/api.test.ts` |
| 4 | `getVoterId: should create once and return the same id` | stable UUID | `frontend/src/lib/storage.test.ts` |
| 5 | `storage: given localStorage throws, should return defaults without throwing` | defaults | `frontend/src/lib/storage.test.ts` |
| 6 | `addTicket: should not duplicate tickets` | list | `frontend/src/lib/storage.test.ts` |

### GREEN — Implementation Order

1. Scaffold + MUI wiring + theme + env.
2. `api.ts` (tests 1–3).
3. `storage.ts` (tests 4–6).

### REFACTOR

- None expected.

## Dependencies

- `TASK-002` (dev server for local API)

## Files to Create/Modify

- `frontend/**` (create via create-next-app)
- `frontend/src/config/theme.ts`, `env.ts`; `frontend/src/lib/api.ts`, `storage.ts` (+ tests); `frontend/src/types/api.ts`

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; `bun run build`, `lint`, `typecheck` clean
- [ ] `bun run dev` serves the placeholder home page (user verifies in browser)

## Spec Updates

- [ ] Update `CLAUDE.md` Commands → Frontend (`typecheck`, `test`) and remove "Design System: TBD" details that no longer apply

# Task: 016 — Ticket page and "My bookings"

## Summary

`/t/[ticket]` is where a booker comes back (from the calendar event or a bookmark). It shows who they are, their slot, their opponent and a countdown, and moves them into the arena when the round opens. The home page also lists bookings saved in this browser. See `docs/system_specs/architecture.md` §4 and §6 ("Ticket → booking → round").

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §4 Lifecycle, §5 `GET /ticket`, `GET /rounds/{roundId}`

## Requirements

### Frontend

1. `/t/[ticket]` MUST call `GET /ticket` with the ticket and `addTicket(ticket)` on success.
2. Invalid ticket (`bad_ticket`) MUST show "This ticket link isn't valid" with a link home.
3. The page MUST show handle, role, local slot date/time, a live countdown to start, and opponent ("vs @riya") or "Waiting for a buyer/seller…".
4. While unpaired, it MUST re-fetch `GET /ticket` every 30 s. Booking `status = "no_opponent"` MUST show "No opponent booked this slot" with a link to book another.
5. When paired, it MUST fetch `GET /rounds/{roundId}` (every 15 s until the round is `ready`, then every 5 s) and show by status:
   - `paired`: "The arena opens 5 minutes before your round."
   - `ready` / `live`: an **Enter the arena** button that renders the arena (TASK-017) on the same page.
   - `cancelled`: "Your opponent didn't show" (or "Round cancelled" for `admin`).
   - `ended` / `closed`: link to the replay page `/r/[roundId]`.
6. Polling MUST stop when the page is hidden (`visibilitychange`) and resume when visible.
7. Home MUST show a "My bookings" section listing tickets from `getTickets()` (fetch each with `GET /ticket`, skip invalid ones, upcoming first), each linking to `/t/[ticket]`.

## Technical Notes

- Put the status → view mapping in a pure function `ticketView(booking, round, now)` for tests.
- Until TASK-017 exists, **Enter the arena** may render a placeholder component; TASK-017 replaces it.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `ticketView: waiting booking should return waiting view` | view kind | `frontend/src/lib/ticketView.test.ts` |
| 2 | `ticketView: no_opponent should return no-opponent view` | view kind | `frontend/src/lib/ticketView.test.ts` |
| 3 | `ticketView: round ready should return enter-arena view` | view kind | `frontend/src/lib/ticketView.test.ts` |
| 4 | `ticketView: cancelled no_show vs admin should return different messages` | message | `frontend/src/lib/ticketView.test.ts` |
| 5 | `pollInterval: should be 30s unpaired, 15s paired, 5s ready, none when ended` | intervals | `frontend/src/lib/ticketView.test.ts` |
| 6 | `formatCountdown: should format mm:ss and hh:mm:ss` | strings | `frontend/src/lib/time.test.ts` |

### GREEN — Implementation Order

1. `lib/ticketView.ts`, `lib/time.ts` (tests 1–6).
2. `app/t/[ticket]/page.tsx` + `components/TicketStatus.tsx`.
3. `components/MyBookings.tsx` on home.

### REFACTOR

- Extract a `usePolling(fn, intervalMs)` hook if two components poll.

## Dependencies

- `TASK-015`, `TASK-009` (`GET /rounds/{roundId}`)

## Files to Create/Modify

- `frontend/src/lib/ticketView.ts`, `time.ts` (+ tests)
- `frontend/src/app/t/[ticket]/page.tsx`
- `frontend/src/components/TicketStatus.tsx`, `MyBookings.tsx`
- `frontend/src/app/page.tsx` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; build, lint, typecheck clean
- [ ] Locally: a booked ticket link shows the right state as `POST /dev/tick?now=` moves the round through its lifecycle (user verifies)

## Spec Updates

- [ ] None

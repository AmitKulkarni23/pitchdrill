# Task: 015 — Schedule and booking flow

## Summary

The home page shows the next 7 days of slots in the visitor's local time with how many sellers/buyers are waiting. Picking a slot opens a booking dialog (role + handle). After booking, the visitor sees their ticket link with "Copy link" and "Add to calendar" (an `.ics` file with the link and a 15-minute reminder). No email, no signup. See `docs/system_specs/architecture.md` §4–§5 and `docs/mvp.md`.

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/architecture.md` — §4 slot rules, §5 `GET /slots`, `POST /bookings`
- `docs/system_specs/data_model.md` — Limits and Validation (`handle`)

## Requirements

### Frontend

1. Home (`/`) MUST load `GET /slots` and group slots by the visitor's local calendar day (tabs or segmented control for each day), labelled like "Today", "Tomorrow", "Thu, Oct 16".
2. Each slot MUST show local start time and counts, e.g. "2 sellers waiting for a buyer", "1 buyer waiting", or "Open".
3. Selecting a slot MUST open a dialog with a role choice (Seller / Buyer, with one-line explanations) and a handle field validated with `^[A-Za-z0-9_]{3,20}$` before submit.
4. Submit MUST `POST /bookings`. Errors MUST show inline with MUI `Alert` using the API message (`handle_taken`, `slot_closed`, …); network errors show a generic retry message.
5. On success the dialog MUST switch to a confirmation view: role, local date/time, "vs @handle" or "Waiting for a buyer/seller…", the ticket link `${window.location.origin}/t/${ticket}`, **Copy link**, **Add to calendar**, and a warning that the link is the only way back in.
6. The ticket MUST be saved with `addTicket(ticket)`.
7. **Add to calendar** MUST download `pitchdrill-<local date>-<time>.ics` built by `src/lib/ics.ts`: one `VEVENT` with `DTSTART`/`DTEND` (start + 15 min) in UTC, `SUMMARY` "PitchDrill: <Role> round", `DESCRIPTION` and `URL` with the ticket link, a `VALARM` with `TRIGGER:-PT15M`, CRLF line endings, escaped text.
8. Loading and empty states MUST be handled (skeletons; "No slots open right now").
9. Times MUST use `Intl.DateTimeFormat` in the visitor's time zone; slot IDs stay UTC ISO strings.

## Technical Notes

- Keep date grouping/labels in `src/lib/slots.ts` (pure, testable). Pass `now` and `timeZone` as parameters for tests.
- Use the Clipboard API with a fallback (select the text field) when it is unavailable.
- `.ics` download: `Blob` + object URL + temporary `<a download>`; revoke the URL afterwards.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `groupSlotsByLocalDay: should group UTC slots into local days in the given time zone` | groups for `America/New_York` vs `Asia/Kolkata` | `frontend/src/lib/slots.test.ts` |
| 2 | `dayLabel: should return Today / Tomorrow / weekday date` | labels | `frontend/src/lib/slots.test.ts` |
| 3 | `waitingLabel: should describe counts` | strings for 0/1/2 sellers/buyers | `frontend/src/lib/slots.test.ts` |
| 4 | `buildIcs: should contain UTC DTSTART/DTEND, URL, VALARM -PT15M and CRLF` | content | `frontend/src/lib/ics.test.ts` |
| 5 | `buildIcs: should escape commas, semicolons and newlines` | escaping | `frontend/src/lib/ics.test.ts` |
| 6 | `isValidHandle: should match backend rule` | cases | `frontend/src/lib/validation.test.ts` |

### GREEN — Implementation Order

1. `lib/slots.ts`, `lib/ics.ts`, `lib/validation.ts` (tests 1–6).
2. `components/SlotPicker.tsx`, `components/BookingDialog.tsx`, `components/BookingConfirmation.tsx`.
3. Wire into `app/page.tsx`.

### REFACTOR

- None expected.

## Dependencies

- `TASK-014`, `TASK-001` (counts in `GET /slots`)

## Files to Create/Modify

- `frontend/src/lib/slots.ts`, `ics.ts`, `validation.ts` (+ tests)
- `frontend/src/components/SlotPicker.tsx`, `BookingDialog.tsx`, `BookingConfirmation.tsx`
- `frontend/src/app/page.tsx` (modify)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN; build, lint, typecheck clean
- [ ] Against the local dev server: booking a seat shows the confirmation; the `.ics` imports into a calendar with the link and a reminder (user verifies)

## Spec Updates

- [ ] None

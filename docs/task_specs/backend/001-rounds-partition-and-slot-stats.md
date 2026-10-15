# Task: 001 — Move rounds to their own partition and add slot stats

## Summary

Phase 1 stores the whole round under the slot partition (`SLOT#<slotId>` / `ROUND#<roundId>`). Votes, comments, reports and replays all look rounds up by `roundId`, so the round's canonical item moves to `ROUND#<roundId>` / `META`, with a small index item left in the slot. At the same time, add the per-slot `STATS` counter and booking `status`, and make `GET /slots` return waiting counts so the schedule can show "2 sellers waiting for a buyer". See `docs/system_specs/data_model.md` (Item Layout, Access Patterns 1, 3, 5).

## Conventions

Read and follow these before writing ANY code:
- `CLAUDE.md`
- `docs/system_specs/data_model.md` — Slot partition, Round partition, Access Patterns
- `docs/system_specs/architecture.md` — §5 API
- `~/TechProjects/project-rules/cdk/rules/universal.rules.md`

## Requirements

### Backend

1. Pairing MUST write the round as `PK=ROUND#<roundId>`, `SK=META` with `roundId`, `slotId`, seller/buyer booking IDs and handles, `status: "paired"`, `votesSold: 0`, `votesNotSold: 0`.
2. Pairing MUST also write `PK=SLOT#<slotId>`, `SK=ROUND#<roundId>` containing only `roundId`.
3. Bookings MUST carry `status`: `"waiting"` when queued, `"paired"` when paired (both the new booking and the opponent's).
4. Every booking transaction MUST update `SLOT#<slotId>` / `STATS` with `ADD`: queued → `waiting<Role>s +1`; paired → `waiting<OtherRole>s -1`, `rounds +1`.
5. The handle guard `Put` MUST stay the first item in the transaction (the handler reads `CancellationReasons[0]` to detect `handle_taken`), and the `STATS` `Update` MUST stay second with its seat-cap condition (`CancellationReasons[1]` → `slot_full`, already built). Fold the waiting/round counters into that same `Update`.
6. `GET /slots` MUST return `{ slots: [{ slotId, sellers, buyers, waitingSellers, waitingBuyers, rounds }] }` for every bookable slot, soonest first, with zeros where no `STATS` item exists.
7. `GET /slots` MUST read stats with `BatchGetItem` in chunks of at most 100 keys and MUST retry `UnprocessedKeys`.
8. `GET /ticket` MUST include `status` in the returned booking.

### Infrastructure

9. `PitchDrillListSlots` MUST get `table.grantReadData` and `TABLE_NAME_ENV`.

## Technical Notes

- The production table holds no bookings (the API is IAM-locked and was never used), so no data migration is needed.
- A DynamoDB transaction cannot touch the same item twice; `STATS` is one item, so combine both counter changes into one `Update` with `ADD a :x, b :y`.
- Keep `createBooking(input, now)` signature; tests pass `now`.

## TDD Plan

### RED — Tests First

| # | Test Name | Asserts | File |
|---|-----------|---------|------|
| 1 | `createBooking: given a waiting seller, should write ROUND#/META with status paired and zero votes` | META item shape | `backend/test/bookings.test.ts` |
| 2 | `createBooking: given pairing, should write SLOT#/ROUND# index item` | index item exists with roundId only | `backend/test/bookings.test.ts` |
| 3 | `createBooking: should set booking status waiting then paired for both sides` | statuses via `getBookingByTicket` | `backend/test/bookings.test.ts` |
| 4 | `createBooking: should keep STATS counts in sync` | after 3 sellers + 2 buyers: waitingSellers 1, waitingBuyers 0, rounds 2 | `backend/test/bookings.test.ts` |
| 5 | `slotsWithStats: given no STATS items, should return zeros for every bookable slot` | shape + zeros | `backend/test/slotStats.test.ts` |
| 6 | `slotsWithStats: given STATS for one slot, should merge counts` | counts on that slot only | `backend/test/slotStats.test.ts` |
| 7 | existing tests | still pass | `backend/test/*.test.ts` |

### GREEN — Implementation Order

1. Update the pairing transaction in `backend/src/lib/bookings.ts` (tests 1–4).
2. Add `slotsWithStats(now)` in `backend/src/lib/slotStats.ts` and use it in `listSlots` (tests 5–6).
3. Grant table read to `PitchDrillListSlots` in the stack.

### REFACTOR

- Extract key builders (`slotPk`, `roundPk`, …) into `backend/src/lib/keys.ts` if they repeat across files.

## Dependencies

- None

## Files to Create/Modify

- `backend/src/lib/bookings.ts` (modify)
- `backend/src/lib/slotStats.ts` (create)
- `backend/src/handlers/listSlots.ts` (modify)
- `backend/test/bookings.test.ts` (modify)
- `backend/test/slotStats.test.ts` (create)
- `infra/lib/backend-stack.ts` (modify — grant + env for ListSlots)

## Acceptance Criteria

- [ ] All RED tests written and failing for the right reason
- [ ] All tests GREEN with minimal implementation (`bun run test:local`)
- [ ] REFACTOR pass complete, no regressions; `bun run typecheck` clean
- [ ] Round META + slot index item + booking status + STATS written as specified
- [ ] `GET /slots` returns counts; verified with a signed request after deploy
- [ ] `cdk diff` reviewed (no replacements), deployed

## Spec Updates

- [ ] Update `docs/system_specs/data_model.md` — remove the "Phase 1 stores the full round under the slot partition" note

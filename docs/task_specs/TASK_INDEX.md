# Task Index

Work through tasks **in order**. Pick the first task that is not struck through and whose dependencies are struck through, read its spec, and follow it. When every acceptance criterion is met, strike the line through here (`~~...~~`) in the same commit as the task's last change.

Each spec follows `docs/TASK_SPEC_TEMPLATE.md`. System context: `docs/system_specs/architecture.md`, `docs/system_specs/data_model.md`.

Done before these specs (phase 1): booking core, ticket lookup, slots, CDK stack, IAM lock — see `docs/system_specs/architecture.md`.

## Backend & Infra

- ~~[TASK-001 — Move rounds to their own partition and add slot stats](backend/001-rounds-partition-and-slot-stats.md) · depends on: none~~ (AWS deploy/verify steps left for the user)
- ~~[TASK-002 — Route registry and local dev server](backend/002-routes-registry-and-dev-server.md) · depends on: 001~~ (`cdk diff`/deploy left for the user)
- ~~[TASK-003 — Recordings bucket, CloudFront and IVS composition config](infra/003-recordings-storage-and-ivs-config.md) · depends on: 002~~ (`cdk diff`/deploy and S3 access check left for the user)
- ~~[TASK-004 — Replay GSI, table stream and OpenRouter secret](infra/004-gsi-stream-and-openrouter-secret.md) · depends on: 003 · **asks the user** for the model ID and to set the key~~ (model chosen; `cdk diff`/deploy and setting the secret left for the user)
- ~~[TASK-005 — Generate briefs with OpenRouter](backend/005-generate-briefs.md) · depends on: 001, 004~~ (deploy and event-source check left for the user)
- [TASK-006 — SlotTick: open slots (T-5 minutes)](backend/006-slot-tick-open.md) · depends on: 001, 002, 005
- [TASK-007 — SlotTick: start rounds or cancel no-shows (T)](backend/007-slot-tick-start.md) · depends on: 003, 006
- [TASK-008 — SlotTick: buzzer, cleanup and replay registration](backend/008-slot-tick-end-and-recordings.md) · depends on: 007
- [TASK-009 — Round details, briefs, join and watch tokens](backend/009-round-read-join-watch.md) · depends on: 002, 006
- [TASK-010 — Spectator chat tokens with nicknames](backend/010-spectator-chat-tokens.md) · depends on: 009
- [TASK-011 — Votes with live tally](backend/011-votes.md) · depends on: 008, 009
- [TASK-012 — Replay feed and comments](backend/012-replays-and-comments.md) · depends on: 008, 009, 010
- [TASK-013 — Reports and IAM-only admin routes](backend/013-reports-and-admin.md) · depends on: 008, 012

## Frontend

- ~~[TASK-014 — Scaffold the Next.js frontend](frontend/014-scaffold.md) · depends on: 002~~ (done early in the impeccable design session; the home page replaced the placeholder)
- [TASK-015 — Schedule and booking flow](frontend/015-schedule-and-booking.md) · depends on: 001, 014 · **mostly built** in the impeccable session (guide, booking desk, ticket link, calendar file). Remaining: switch the guide to `GET /slots` counts once 001 lands (drop the local `scheduleSlots` fallback in TASK-021), and verify booking against the dev server (002)
- [TASK-016 — Ticket page and "My bookings"](frontend/016-ticket-page.md) · depends on: 009, 015
- [TASK-017 — Participant arena (split screen, brief, timer)](frontend/017-participant-arena.md) · depends on: 007, 009, 016
- [TASK-018 — Live rounds, spectator view, chat and voting](frontend/018-spectator-live.md) · depends on: 010, 011, 017
- [TASK-019 — Replay page, comments, reports and replay feed](frontend/019-replays.md) · depends on: 012, 013, 018
- [TASK-020 — Vercel deployment](frontend/020-vercel-deploy.md) · depends on: 014

## Go Live

- [TASK-021 — Open the API to the public](infra/021-unlock-public-api.md) · depends on: 013, 019, 020 · **requires user approval**

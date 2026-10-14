# PitchDrill Architecture

## Overview

```
 Browser (Next.js on Vercel)
   │  HTTPS / JSON                       │ video + live chat (phase 2, straight to AWS IVS)
   ▼                                     ▼
 API Gateway (HTTP API) ──► Lambda (TypeScript, Node.js 24) ──► DynamoDB
   CORS + per-route throttles
 Logs/traces/metrics: Powertools for AWS Lambda ──► CloudWatch + X-Ray
```

All AWS resources live in one CDK stack, `PitchDrillBackendStack`, in **us-west-2**. There is only a production environment: stateful resources are retained on delete and protected from deletion.

## Decisions

| Area | Decision |
|---|---|
| Language | TypeScript everywhere. Bun for install, tests and bundling; Lambdas run on Node.js 24 (arm64). |
| Dependency injection | None. Modules export what they need (e.g. the DynamoDB client); tests run against DynamoDB Local. |
| Compute | One Lambda per route behind an API Gateway HTTP API. |
| Database | DynamoDB, single table, on-demand, point-in-time recovery. |
| Auth | No accounts. A booking returns a random ticket once; only its SHA-256 hash is stored. Admin routes (phase 2) use IAM (SigV4) auth. |
| IAM | Least-privilege `.grant*()` on every Lambda; no access keys. Services without grant methods (IVS) get scoped `addToRolePolicy` statements with a comment. |
| Rate limiting | HTTP API per-route throttles (all users combined, not per IP). Default 50 rps / burst 100; `POST /bookings` 10/20; `GET /ticket` 20/40; `GET /slots` 20/40. |
| CORS | `http://localhost:3000` until the Vercel domain exists. |
| Logging | Powertools Logger (JSON, request ID on every line), Tracer (X-Ray), Metrics (EMF). Log retention 1 month. |
| Alarms | Named by user impact; console only (no notifications yet). |
| LLM briefs | OpenRouter (phase 2). Placeholder stub in `backend/src/lib/briefs.ts`. |

## Booking Rules

- Slots: every 15 minutes, 4:00–8:45 PM `America/Los_Angeles`. Slot ID = UTC ISO start time.
- Bookable from 7 days ahead until 5 minutes before the start.
- Handle: 3–20 letters, numbers or underscores; unique per slot, case-insensitive.
- Pairing: first-come-first-serve at booking. A new booking pairs with the oldest unpaired booking of the other role in that slot.

## Identity Flow (ticket → booking → round)

```
ticket in link ──► TICKET#<hash> row ──► booking (handle, role, slot) ──► round (seller vs buyer) ──► IVS stage (phase 2)
```

The ticket is like a coat-check tag: no profile, no account. The booking holds everything; the ticket is the only way back to it.

## DynamoDB Table (`pitchdrill-main`)

| PK | SK | Attributes |
|---|---|---|
| `SLOT#<slotId>` | `BOOKING#<bookingId>` | handle, role, createdAt, roundId?, opponentHandle? |
| `SLOT#<slotId>` | `WAIT#<role>#<createdAt>#<bookingId>` | bookingId, handle (unpaired queue, oldest first) |
| `SLOT#<slotId>` | `HANDLE#<lowercase handle>` | (uniqueness guard) |
| `SLOT#<slotId>` | `ROUND#<roundId>` | seller/buyer booking IDs + handles |
| `TICKET#<sha256>` | `TICKET` | slotId, bookingId |

## API (phase 1)

| Route | Purpose |
|---|---|
| `GET /slots` | Bookable slot IDs for the next 7 days |
| `POST /bookings` `{ slotId, handle, role }` | Book + pair. Returns `{ ticket, booking }` (ticket shown once) |
| `GET /ticket` (header `x-ticket`) | The booking for a ticket, incl. opponent once paired |

Errors are always `{ error: { code, message } }` with a user-safe message.

## Phase 2

IVS Real-Time stages + participant tokens, scheduler, IVS Chat, OpenRouter briefs, votes, comments, recording to S3, reports + IAM-auth admin routes.

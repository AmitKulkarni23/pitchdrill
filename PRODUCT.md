# Product

<!-- impeccable:product-schema 1 -->

<!-- Written during an autonomous session at the user's instruction ("don't wait for my input"). Facts come from decisions the user confirmed in conversation (see docs/mvp.md, docs/system_specs/). Items marked (inferred) were not confirmed and should be checked. -->

## Platform

web

## Stack

Next.js (App Router) on Vercel, MUI with `sx` props (no CSS Modules, no Tailwind), Bun. Backend: AWS (API Gateway, Lambda, DynamoDB, IVS Real-Time + Chat) in us-west-2. Chosen by the user.

## Users

- **Sellers**: anyone who wants to practise selling. They book a slot, show up on camera at a set time, and get 60 seconds to sell a product they only learn about 30 seconds before the round.
- **Buyers**: anyone who wants to practise objection handling or play the skeptic. They get a hidden persona (budget, doubts, reasons to say no) and push back.
- **Spectators**: anyone with the link. They watch rounds live or as replays, chat under a nickname, vote "Sold" / "Not sold", and comment.
- (inferred) Typical seller/buyer: early-career salespeople, founders, job-seekers preparing for "sell me this pen" interviews, joining from a laptop or phone at home in the evening.

## Product Purpose

PitchDrill is a one-minute sales drill arena. People book a slot, get matched with an opponent, and run a live 60-second split-screen round: the seller tries to close, the buyer tries to say no, and the audience decides. Success means people come back for repeated reps, rounds actually start (both sides show up), and spectators vote and comment.

## Positioning

Live, timed, two-sided practice with real strangers and a real audience verdict. The seller doesn't know the product until 30 seconds before; the buyer has a secret persona the seller never sees. Every round is short, public, recorded and judged, and it needs no account.

## Operating Context

- Slots every 15 minutes, 4:00–8:45 PM Pacific; booking opens 7 days ahead and closes 5 minutes before start. Times are shown in the visitor's local time zone.
- No login or signup. A booking returns a private ticket link (the only way back in); people keep it via "Copy link" or "Add to calendar" (`.ics` with a 15-minute reminder). Spectators are anonymous, identified per browser, with a nickname typed once.
- Pairing is first-come-first-serve within a slot; all rounds in a slot run in parallel.
- Round flow: arena opens at T-5 min → briefs visible at T-30 s → 60-second round → buzzer → votes → replay with comments.
- No-show → the round is cancelled.

## Capabilities and Constraints

- Live video and chat via Amazon IVS (seller left, buyer right); spectators watch with ~0.3 s latency.
- Votes: one per browser per round, tally always visible, open forever (replays too).
- Replays are recorded split-screen videos; comments and reports on each round.
- Moderation through IAM-only admin routes; no admin UI.
- The API is IAM-locked until the user approves opening it (TASK-021). Nothing is public yet.
- Terminology: **slot** (start time), **round** (one seller vs one buyer), **ticket** (private link), **handle** (public booking name), **nickname** (spectator chat name), **brief** (product sheet / buyer persona), **buzzer**, **Sold / Not sold**.

## Brand Commitments

- Name: **PitchDrill**. No logo, colors or fonts exist yet.
- The user's earlier project (KnowThyNeighbor) used a strong themed visual identity documented in `DESIGN.md`; PitchDrill should have its own documented identity in `DESIGN.md`.

## Evidence on Hand

- None. No users, rounds, testimonials, recordings or metrics exist yet. Do not fabricate counts, quotes, leaderboards or "X rounds played" claims.

## Product Principles

1. **Zero friction**: a handle and a ticket link are all you need; never add a signup step.
2. **One minute, no more**: the constraint is the product; time is always visible.
3. **Asymmetric information**: seller and buyer see different briefs; never leak the buyer persona to the seller or spectators.
4. **Practice in public**: live audience, votes, replays and comments are how people improve.
5. **Show up or it fails**: everything around booking (reminders, clear times, the ticket link) exists to get both people into the arena on time.

## Accessibility & Inclusion

- (inferred) WCAG 2.2 AA. Live video needs clear camera/mic permission states, keyboard-operable controls, and timers that are readable without relying on color alone.

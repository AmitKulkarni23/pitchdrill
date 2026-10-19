# Product

<!-- impeccable:product-schema 1 -->

<!-- Written during an autonomous session at the user's instruction ("don't wait for my input"). Facts come from decisions the user confirmed in conversation (see docs/mvp.md, docs/system_specs/). Items marked (inferred) were not confirmed and should be checked. Re-interviewed 2026-10-14: positioning moved from "sales show" to learning, and the home became a place to watch rounds before booking. -->

## Platform

web

## Stack

Next.js (App Router) on Vercel, MUI with `sx` props (no CSS Modules, no Tailwind), Bun. Backend: AWS (API Gateway, Lambda, DynamoDB, IVS Real-Time + Chat) in us-west-2. Chosen by the user.

## Users

- **Sellers**: anyone who wants to practise selling. They book a slot, show up at a set time (audio only for now), and get 2 minutes to sell a product they only learn about 5 minutes before the round.
- **Buyers**: anyone who wants to practise objection handling or play the skeptic. They get a hidden persona (budget, doubts, reasons to say no) and push back.
- **Watchers (learners)**: anyone with the link. Watching is a first-class way to learn, not a side audience: they browse and watch rounds live or as replays, chat under a nickname, vote "Sold" / "Not sold", and comment. Many people watch several rounds before they ever book one.
- (inferred) Typical seller/buyer: early-career salespeople, founders, job-seekers preparing for "sell me this pen" interviews, joining from a laptop or phone at home in the evening.

## Product Purpose

PitchDrill is a place to learn selling through two-minute drills, by doing them and by watching them, with equal weight. People book a slot, get matched with an opponent, and run a live 2-minute split-screen round: the seller tries to close, the buyer tries to say no, and the audience decides. Everyone else learns by watching live rounds and the growing library of replays. Success means people come back for repeated reps, rounds actually start (both sides show up), and watchers keep watching, voting and commenting.

## Positioning

A learning experience, not a sales show. Live, timed, two-sided practice with real strangers and a real audience verdict. The seller doesn't know the product until 5 minutes before; the buyer has a secret persona the seller never sees. Every round is short, public, recorded and judged, and it needs no account.

## Operating Context

- Slots every 15 minutes, 4:00–8:45 PM Pacific; booking opens 7 days ahead and closes 5 minutes before start. Times are shown in the visitor's local time zone.
- No login or signup. A booking returns a private ticket link (the only way back in); people keep it via "Copy link" or "Add to calendar" (`.ics` with a 15-minute reminder). Spectators are anonymous, identified per browser, with a nickname typed once.
- A first-time visitor can browse live, upcoming and past rounds before booking anything; booking is always reachable but is not the only door in. The home's exact layout (lobby, library grid, or a mix) is a surface decision, not settled here.
- Pairing is first-come-first-serve within a slot; all rounds in a slot run in parallel.
- Round flow: briefs visible at T-5 min → arena opens at T-2 min → 2-minute round → buzzer → votes → replay with comments.
- No-show → the round is cancelled.

## Capabilities and Constraints

- Live video and chat via Amazon IVS (seller left, buyer right); spectators watch with ~0.3 s latency.
- Votes: one per browser per round, tally always visible, open forever (replays too). Feedback stays Sold / Not sold plus free comments (confirmed 2026-10-14); no structured rubric for now.
- Replays are recorded split-screen videos; comments and reports on each round.
- Moderation through IAM-only admin routes; no admin UI.
- The API is IAM-locked until the user approves opening it (TASK-021). Nothing is public yet.
- Terminology: **slot** (start time), **round** (one seller vs one buyer), **ticket** (private link), **handle** (public booking name), **nickname** (spectator chat name), **brief** (product sheet / buyer persona), **buzzer**, **Sold / Not sold**.

## Brand Commitments

- Name: **PitchDrill**. No logo, colors or fonts exist yet.
- Not "sales-y" (user, 2026-10-14). The shopping-channel broadcast identity in the current `DESIGN.md` is rejected and will be replaced. It should feel modern and like a learning experience.

## Evidence on Hand

- None. No users, rounds, testimonials, recordings or metrics exist yet. Do not fabricate counts, quotes, leaderboards or "X rounds played" claims.

## Product Principles

1. **Zero friction**: a handle and a ticket link are all you need; never add a signup step.
2. **Two minutes, no more**: the constraint is the product; time is always visible.
3. **Asymmetric information**: seller and buyer see different briefs; never leak the buyer persona to the seller or spectators.
4. **Learn by doing and by watching**: booking a round and watching one are equal paths; live rounds, replays, votes and comments are how people improve.
5. **Watch before you book**: anyone can see what rounds look like before committing to one.
6. **Show up or it fails**: everything around booking (reminders, clear times, the ticket link) exists to get both people into the arena on time.

## Accessibility & Inclusion

- (inferred) WCAG 2.2 AA. Live video needs clear camera/mic permission states, keyboard-operable controls, and timers that are readable without relying on color alone.

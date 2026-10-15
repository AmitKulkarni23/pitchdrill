# PitchDrill MVP

## Decided

- **Identity**: Public handle + private ticket link (no login).
- **Slots & matching**: Many people can book the same slot as seller or buyer. Pairing is first-come-first-serve at booking (new booking ↔ oldest unpaired opposite role), so both see their opponent on the ticket.
- **Slot grid**: Every 15 minutes, 4:00 PM – 8:45 PM Pacific (`America/Los_Angeles`, follows PST/PDT) — 20 slots/day. Stored as UTC, shown in the viewer's local time.
- **Handles**: Unique per slot (one booking per handle per slot, either role).
- **Rounds**: All rounds in a slot run in parallel, one stage each; spectators pick which to watch.
- **Audience**: Watch live + replay. Votes and comments on both.
- **Voting**: Anyone, one vote per browser per round ("Sold" / "Not sold").
- **Briefs**: LLM-generated. Seller gets a product sheet; buyer gets a hidden persona. Revealed ~30s before the round.
- **Round length**: 60 seconds, enforced server-side.
- **Coming back**: no email. After booking: copy the ticket link or "Add to calendar" (`.ics` with the link and a 15-minute reminder).
- **Spectator names**: a nickname typed once (saved in the browser) for chat and comments.
- **No-shows**: if both sides aren't publishing at start, the round is cancelled.
- **Vote tally**: always visible, live.
- **Moderation**: public report button; IAM-only admin routes (list reports, end a round, hide a replay); no admin UI.
- **Recording**: one split-screen recording per round (IVS server-side composition), replayed via CloudFront.
- **Briefs**: random product generated via OpenRouter when a round is paired; fallback list if it fails.

## Functional Requirements

1. Browse today's (and upcoming) slots with counts of waiting sellers/buyers.
2. Book a slot as seller or buyer with a handle; receive a ticket link once, plus opponent when paired.
3. Join the arena with the ticket; see your brief before the round.
4. 60s live split-screen round (seller left, buyer right) with a visible timer.
5. Spectators watch live, chat, and vote at the buzzer.
6. Replay page per round: video, vote result, comments, voting still open.
7. Report a round; admin can end a live stage.

## Out of MVP

- Transcription (Amazon Transcribe on recordings) and AI scoring of pitches
- Leaderboards, handle history, stats
- Re-matching when one side no-shows

## Open Questions

- ~~Is there a cap on rounds per slot (IVS cost)?~~ Decided 2026-10-14: 4 sellers + 4 buyers per slot, so at most 4 rounds.
- Can one handle book more than one slot per day?
- Minimum age / content rules for live video?

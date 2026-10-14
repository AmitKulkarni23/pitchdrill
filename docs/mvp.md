# PitchDrill MVP

## Decided

- **Identity**: Public handle + private ticket link (no login). *Assumed — confirm.*
- **Matching**: Each slot has 2 seats (Seller, Buyer); first to book each seat gets it.
- **Audience**: Watch live + replay. Votes and comments on both.
- **Voting**: Anyone, one vote per browser per round ("Sold" / "Not sold").
- **Briefs**: LLM-generated. Seller gets a product sheet; buyer gets a hidden persona. Revealed ~30s before the round.
- **Round length**: 60 seconds, enforced server-side.

## Functional Requirements

1. Browse today's (and upcoming) slots with seat availability.
2. Book an open seat with a handle; receive a ticket link once.
3. Join the arena with the ticket; see your brief before the round.
4. 60s live split-screen round (seller left, buyer right) with a visible timer.
5. Spectators watch live, chat, and vote at the buzzer.
6. Replay page per round: video, vote result, comments, voting still open.
7. Report a round; admin can end a live stage.

## Out of MVP

- Transcription (Amazon Transcribe on recordings) and AI scoring of pitches
- Leaderboards, handle history, stats
- Re-matching when one seat no-shows

## Open Questions

- How many slots per day, and at what times / time zone?
- What happens if a seat is empty or someone no-shows?
- Can one handle book both seats, or more than one slot per day?
- Is the vote visible live, or revealed at the buzzer?
- Product categories for briefs: random, or picked by the seller?
- Minimum age / content rules for live video?

# PitchDrill MVP

## Decided

- **Identity**: Public handle + private ticket link (no login).
- **Slots & matching**: Many people can book the same slot as seller or buyer. Pairing is first-come-first-serve at booking (new booking ↔ oldest unpaired opposite role), so both see their opponent on the ticket.
- **Rounds**: All rounds in a slot run in parallel, one stage each; spectators pick which to watch.
- **Audience**: Watch live + replay. Votes and comments on both.
- **Voting**: Anyone, one vote per browser per round ("Sold" / "Not sold").
- **Briefs**: LLM-generated. Seller gets a product sheet; buyer gets a hidden persona. Revealed ~30s before the round.
- **Round length**: 60 seconds, enforced server-side.

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

- Slot grid: how often (e.g. every 30 min), what hours, which time zone?
- Is there a cap on rounds per slot (IVS cost)?
- What happens when someone no-shows (opponent waits alone)?
- Can one handle book both roles, or more than one slot per day? (Handles unique per slot or global?)
- Is the vote visible live, or revealed at the buzzer?
- Product categories for briefs: random, or picked by the seller?
- Minimum age / content rules for live video?

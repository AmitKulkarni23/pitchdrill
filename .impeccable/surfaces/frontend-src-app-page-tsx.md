---
version: 1
slug: "frontend-src-app-page-tsx"
primary_target: "frontend/src/app/page.tsx"
related_targets: []
---

# Home (`/`) — surface brief

Scope: the public home page. Mode: Persuade (a first-time visitor understands the drill and books a slot), with an Operate core (program guide + booking).

Audience/job: early-career sellers, founders, interview-preppers, skeptics who want to play buyer; evening, laptop or phone. Action: book a seller or buyer seat in a slot. Proof: an illustrated example round (labelled as an example), the real slot schedule, real live/replay sections (empty until rounds exist). Constraints: no signup copy, no invented stats or testimonials, times in the visitor's local zone, API may be unavailable (IAM-locked) so the guide must still render from the known slot rules.

## Direction contract

THESIS: PitchDrill is a live shopping channel where anyone can be the presenter. The page is a broadcast, not a SaaS landing: it refuses the gradient hero + video-call mockup + feature-card grid.

OWN-WORLD: Saturated studio cobalt fields; white and price-burst yellow type; on-air red only for LIVE and the clock under 10s. Condensed heavy caps for straps and clocks with tabular figures, plain workhorse sans for reading. Components are broadcast graphics: channel bug, lower-third name straps with SELLER/BUYER role tabs, price bursts, an ON AIR countdown clock, a TV-listings program guide grid, tally bars.

STORY: You land mid-broadcast. You see what a round is (two straps, a product, a 60-second clock, a Sold/Not sold tally), believe you could step in, and book a slot from the program guide in under a minute.

FIRST VIEWPORT: Top bar: channel bug "PitchDrill" left, "NEXT ROUND 4:00 PM" clock right. Left 55%: headline "Sixty seconds to sell it." with one-line mechanism and yellow "Book a slot" action + "How a round runs" link. Right 45%: the example round plate (split screen with seller/buyer straps, product lower third with price burst, 0:60 clock, tally bars), labelled "Example round". Mobile: headline, action, then plate.

FORM: Live TV shopping-channel broadcast graphics; position 3 on the ordered list (1 fight card, 2 scoreboard, 3 shopping broadcast, 4 auction catalogue, 5 split-flap board, 6 debate ballot, 7 sales bell). Seed key 8879be79. Raises: from terminal wayfinding, each step shows only the next decision (slot → role → handle), times monumental. From the op-art textile, total palette commitment: no stray grays, fields own whole regions. From the BBS nightboard, presence is precious: "Live now" is a ticker that only appears when something is live. From the darkroom, stages are irreversible and timed: the rundown names the point of no return.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Live now / replays need backend tasks 009–012; render honest empty states until then.

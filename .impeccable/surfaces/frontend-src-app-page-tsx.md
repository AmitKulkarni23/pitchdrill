---
version: 1
slug: "frontend-src-app-page-tsx"
primary_target: "frontend/src/app/page.tsx"
related_targets: []
---

# Home (`/`) — surface brief

Scope: the public home page. Mode: Experience with an Operate core (watch rounds, book a seat). Replaces the rejected shopping-channel broadcast home.

Audience/job: first-time visitors and returning learners, evening, laptop or phone. Watch before you book; watching and playing weigh the same. Proof: real live rounds and replays only (empty until backend 009/012 land); the real slot schedule from `GET /slots`, falling back to the slot rules while the API is IAM-locked. Constraints: no signup copy, no invented stats, times in the visitor's zone, never show a buyer persona. Approved mockup: https://claude.ai/artifact/URDQkpThdn3PB9Szwqn8VD (Main = populated, Launch = no recordings, Mobile).

## Direction contract

THESIS: A study hall for selling: watch a round, then play one. Refuses the sales-y broadcast and the SaaS hero; the page is a calm learning app like an online chess archive.

OWN-WORLD: Light grey ground #F7F7F5, white panels with 1px #E6E8EB lines and 16px radius, ink #1C1F24, one deep green #2F6E50 for actions and Sold, sand #F1EDE4 for Not sold, seller tint slate-blue and buyer tint sand. Manrope throughout, tabular numerals. LIVE is red text plus dot, never color alone.

STORY: The visitor sees what is live (or when the next round starts), sees they can play in three fields, and finds every past round below to learn from.

FIRST VIEWPORT: Header (60 mark + PitchDrill, Watch / Play / How it works, green Book a seat). Headline "Learn to sell in sixty seconds." Two panels: Watch (7/12: live tiles, or next start time and countdown) and Play (5/12: next open slot, Seller/Buyer, handle, Book). Phone: stacked Watch, Play.

FORM: Study Hall (online chess archive), safer-register grounded candidate 1, seed key ceced385.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Live tiles and the past-rounds archive need `GET /rounds/live` (009) and `GET /replays` (012); until then the launch-day state renders (today's slots + how a round runs).

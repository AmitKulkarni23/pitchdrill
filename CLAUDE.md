# PitchDrill

A one-minute sales drill arena. Anyone can book a seat as a seller or a buyer, get matched in a live split-screen round, and try to close (or refuse) a deal in 60 seconds while an audience watches, votes and comments.

## What It Does

Each day has scheduled time slots. People book a slot as a seller or a buyer with a public handle — no signup — and receive a private ticket link that proves the booking is theirs. Within a slot, sellers and buyers are paired first-come-first-serve at booking time, and every pair gets its own round. All rounds in a slot run in parallel; spectators pick which one to watch. Just before the round, both sides get an LLM-generated brief: the seller sees a product sheet, the buyer sees a hidden persona (budget, doubts, reasons to say no). The round runs for 60 seconds on a split screen. Spectators watch live, chat, and vote "Sold" or "Not sold" at the buzzer. The recording stays up for replay, votes and comments.

## Design Principles

- **Zero friction**: No login, no signup. A handle and a ticket link are all you need.
- **One minute, no more**: The constraint is the product. Rounds are short, sharp and repeatable.
- **Asymmetric information**: Seller and buyer get different briefs, so every round has real tension.
- **Practice in public**: Live audience, replays, votes and comments are how people improve.
- **Flow**: Pick slot → Book as seller or buyer (handle) → Get ticket link + opponent → Join arena → Read brief → 60s round → Votes + comments.

## Tech Stack

- **Frontend**: Next.js (App Router) on Vercel
- **Backend**: AWS (us-west-2) — Lambda (TypeScript, Node.js 24, arm64) behind API Gateway HTTP API, DynamoDB, S3
- **Live video**: Amazon IVS Real-Time (stages) with server-side composite recording to S3
- **Live chat**: Amazon IVS Chat
- **LLM briefs**: OpenRouter (phase 2; stub in `backend/src/lib/briefs.ts`)
- **Scheduling**: EventBridge Scheduler (open/close stages at slot times)
- **Infrastructure as Code**: AWS CDK (TypeScript) in `infra/`
- **Observability**: Powertools for AWS Lambda (Logger, Tracer, Metrics) → CloudWatch + X-Ray
- **Runtime / tooling**: Bun (install, scripts, tests, Lambda bundling). Lambdas run on the Node runtime; Bun is not a first-class Lambda runtime.

## Folder Structure

```
pitchdrill/
├── docs/                     # Product spec, architecture notes, decisions
├── frontend/                 # Next.js app (App Router), deployed to Vercel
│   ├── src/
│   │   ├── app/              # Pages, layouts
│   │   ├── components/       # Reusable React components
│   │   ├── config/           # API base URL, environment config
│   │   ├── types/            # TypeScript type definitions
│   │   └── lib/              # Utility functions, API client, ticket storage
│   └── public/               # Static assets
├── backend/                  # Lambda handlers (TypeScript)
│   ├── src/
│   │   ├── handlers/         # One file per API route / scheduled job
│   │   └── lib/              # DynamoDB access, IVS, briefs, shared helpers
│   └── test/                 # bun test
├── infra/                    # AWS CDK app
│   ├── bin/                  # CDK app entry
│   └── lib/                  # Stacks and constructs
├── .gitignore
├── CLAUDE.md
└── README.md
```

## Data Model

DynamoDB single table `pitchdrill-main` (key layout in `docs/architecture.md`). Core entities: `slots`, `bookings`, `rounds`, `votes`, `comments`, `reports`. A slot is a scheduled start time. A booking holds a slot, a role (seller/buyer), the booker's public handle and the SHA-256 hash of their ticket — never the raw ticket. A round pairs one seller booking with one buyer booking in a slot and links to its IVS stage, chat room, generated briefs, recording location and vote tallies. Votes are keyed by `roundId + voterId` (one per browser). Comments belong to a round.

## Key Behaviors

- No accounts. Identity is a public handle plus a private ticket (random token) returned once at booking, shown as a link and saved in localStorage.
- Slots run every 15 minutes, 4:00–8:45 PM `America/Los_Angeles` (20 per day). Slot IDs are UTC ISO start times; the frontend shows local time.
- Slots are bookable from 7 days ahead until 5 minutes before start.
- Handles are 3–20 letters, numbers or underscores, unique per slot (case-insensitive, either role).
- A slot holds any number of rounds. Pairing is first-come-first-serve at booking: a new booking is paired with the oldest unpaired booking of the opposite role in that slot, creating a round. Pairing uses a conditional write so one booking is never paired twice.
- Unpaired bookings wait; if still unpaired at slot time they are told no opponent was found.
- All rounds in a slot start together; the arena page lists live rounds for spectators to pick from.
- Briefs are generated via OpenRouter when a round is paired and revealed to each side ~30s before the round. The buyer's persona is never shown to the seller.
- Rounds are 60 seconds, enforced server-side. Spectators watch live and vote "Sold" / "Not sold" at the buzzer.
- Recordings are kept for replay; votes and comments stay open on replays.
- Voters are identified by a random voter ID in localStorage: one vote per browser per round, rate-limited.
- Anyone can report a round; an admin can end a live stage.

## Commands

### Frontend

```bash
cd frontend && bun install
cd frontend && bun run dev
cd frontend && bun run build
cd frontend && bun run lint
```

### Backend

```bash
cd backend && bun install
cd backend && bun run typecheck
cd backend && bun run build        # bundles handlers to backend/dist (infra runs this on synth)

# Tests run against DynamoDB Local (OrbStack/Docker must be running)
docker run -d --rm --name pitchdrill-ddb -p 8000:8000 amazon/dynamodb-local
cd backend && bun run test:local
```

### Infra (AWS CDK)

```bash
cd infra && bun install
cd infra && bunx cdk synth
cd infra && bunx cdk diff
cd infra && bunx cdk deploy --all   # deploys to the default AWS profile's account, us-west-2
```

### Vercel

```bash
vercel            # preview
vercel --prod     # production
vercel env pull .env.local
```

## Design System

TBD. Will be documented in `DESIGN.md` once the visual identity is chosen. Record tokens, shared styles, theme and fonts here when they exist.

## Architecture

- **No API routes on Vercel.** Next.js is the frontend only. All data access goes through the AWS API (API Gateway → Lambda → DynamoDB).
- **IVS Real-Time** for the seller/buyer split screen, one stage per round; spectators subscribe with view-only tokens. Composite recording goes to S3.
- **IVS Chat** for live comments during a round; replay comments are stored in DynamoDB.
- **OpenRouter** for product briefs and buyer personas, called only from Lambda (key in Secrets Manager when added).
- **EventBridge Scheduler** opens stages before a slot and closes them after the round.

## Security Model

- Raw tickets are returned once at booking and never stored; DynamoDB keeps only their SHA-256 hash. Tickets are looked up by hash key, never compared in app code.
- IVS publish tokens are minted only for the seller/buyer holding a valid ticket for that round. Spectators get subscribe-only tokens.
- Briefs are served per side: each brief endpoint requires that side's ticket.
- AWS access lives in Lambda IAM roles granted with `.grant*()`, never in the frontend. Services without grant methods (IVS) get `addToRolePolicy` scoped to exact actions and resources, with a comment.
- Admin routes (phase 2) use API Gateway IAM (SigV4) auth.
- API Gateway HTTP API per-route throttles (all users combined, not per IP — HTTP APIs don't support WAF). Limits in `docs/architecture.md`.
- CORS allows only `http://localhost:3000` until the Vercel domain is added.

## Error Handling

- Lambda handlers return a consistent `{ error: { code, message } }` shape with user-safe messages; never leak raw AWS errors.
- Log with the Powertools `logger` (`backend/src/lib/observability.ts`): JSON with the request ID. Throw `UserError` for expected rejections; anything else is logged and returned as a generic 500.
- Frontend shows failures inline where the user acted.

## Infrastructure as Code

All AWS infrastructure is managed with AWS CDK in `infra/` — no ClickOps.

- **Stack**: one stack, `PitchDrillBackendStack` (`infra/lib/backend-stack.ts`), us-west-2, production only. Follow `~/TechProjects/project-rules/cdk/rules/universal.rules.md`.
- **Prod data**: DynamoDB uses `RemovalPolicy.RETAIN` and deletion protection.
- **Lambda env vars** end in `_ENV` (e.g. `TABLE_NAME_ENV`). Log groups have explicit 1-month retention.
- **Alarms** are named by user impact (e.g. `pitchdrill-users-cannot-book`); console only for now.
- **Deploy**: `bunx cdk diff` before every `bunx cdk deploy`.
- **Never** create or change AWS resources in the console. Every change goes through CDK so it is version-controlled and reproducible.

## Browser Automation

**Do not run any browser automation (playwright-cli or claude-in-chrome) unless the user explicitly asks for it.** Verify changes with type-check, lint, tests and `cdk synth`, and let the user check the UI.

When the user does ask, use the `/playwright-cli` skill (screenshots, clicking, form filling). Never use claude-in-chrome MCP tools.

## Git Conventions

- Commit messages must be at most 2 sentences/phrases long.
- Commit and push to GitHub after each meaningful file or logical unit of work is complete.

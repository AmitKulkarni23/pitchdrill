# PitchDrill

A one-minute sales drill arena. Anyone can book a seat as a seller or a buyer, get matched in a live split-screen round, and try to close (or refuse) a deal in 60 seconds while an audience watches, votes and comments.

## What It Does

Each day has scheduled slots. Every slot has two seats: Seller and Buyer. People book a seat with a public handle — no signup — and receive a private ticket link that proves the seat is theirs. Just before the round, both sides get an LLM-generated brief: the seller sees a product sheet, the buyer sees a hidden persona (budget, doubts, reasons to say no). The round runs for 60 seconds on a split screen. Spectators watch live, chat, and vote "Sold" or "Not sold" at the buzzer. The recording stays up for replay, votes and comments.

## Design Principles

- **Zero friction**: No login, no signup. A handle and a ticket link are all you need.
- **One minute, no more**: The constraint is the product. Rounds are short, sharp and repeatable.
- **Asymmetric information**: Seller and buyer get different briefs, so every round has real tension.
- **Practice in public**: Live audience, replays, votes and comments are how people improve.
- **Flow**: Pick slot → Book seat (handle) → Get ticket link → Join arena → Read brief → 60s round → Votes + comments.

## Tech Stack

- **Frontend**: Next.js (App Router) on Vercel
- **Backend**: AWS — Lambda (TypeScript, Node runtime) behind API Gateway HTTP API, DynamoDB, S3
- **Live video**: Amazon IVS Real-Time (stages) with server-side composite recording to S3
- **Live chat**: Amazon IVS Chat
- **LLM briefs**: Amazon Bedrock (Claude)
- **Scheduling**: EventBridge Scheduler (open/close stages at slot times)
- **Infrastructure as Code**: AWS CDK (TypeScript) in `infra/`
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
│   │   └── lib/              # DynamoDB access, IVS, Bedrock, shared helpers
│   └── test/                 # bun test
├── infra/                    # AWS CDK app (stacks for API, data, IVS, schedules)
│   ├── bin/                  # CDK app entry
│   └── lib/                  # Stacks and constructs
├── .gitignore
├── CLAUDE.md
└── README.md
```

## Data Model

DynamoDB. Core entities: `slots`, `seats`, `rounds`, `votes`, `comments`, `reports`. A slot is a scheduled time with two seats (seller, buyer). A seat holds the booker's public handle and the SHA-256 hash of their ticket — never the raw ticket. A round links a slot to its IVS stage, chat room, generated briefs, recording location and vote tallies. Votes are keyed by `roundId + voterId` (one per browser). Comments belong to a round.

## Key Behaviors

- No accounts. Identity is a public handle plus a private ticket (random token) returned once at booking, shown as a link and saved in localStorage.
- Each slot has exactly two seats; first to book a seat gets it. Booking is a conditional write — no double booking.
- Briefs are generated via Bedrock when both seats fill and revealed to each side ~30s before the round. The buyer's persona is never shown to the seller.
- Rounds are 60 seconds, enforced server-side. Spectators watch live and vote "Sold" / "Not sold" at the buzzer.
- Recordings are kept for replay; votes and comments stay open on replays.
- Voters are identified by a random voter ID in localStorage: one vote per browser per round, rate-limited.
- Anyone can report a round; an admin can end a live stage.

## Commands

Planned — fill in as each package is scaffolded.

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
cd backend && bun test
```

### Infra (AWS CDK)

```bash
cd infra && bun install
cd infra && bunx cdk synth
cd infra && bunx cdk diff
cd infra && bunx cdk deploy --all
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
- **IVS Real-Time** for the seller/buyer split screen; spectators subscribe with view-only tokens. Composite recording goes to S3.
- **IVS Chat** for live comments during a round; replay comments are stored in DynamoDB.
- **Bedrock** for product briefs and buyer personas, called only from Lambda.
- **EventBridge Scheduler** opens stages before a slot and closes them after the round.

## Security Model

- Raw tickets are returned once at booking and never stored; DynamoDB keeps only their SHA-256 hash. Compare hashes in constant time.
- IVS publish tokens are minted only for the seller/buyer holding a valid ticket for that slot. Spectators get subscribe-only tokens.
- Briefs are served per seat: the buyer persona endpoint requires the buyer's ticket.
- All AWS credentials and Bedrock access live in Lambda IAM roles, never in the frontend.
- API Gateway throttling plus per-voter/per-IP limits on booking, voting and comments.
- CORS allows only the Vercel domains.

## Error Handling

- Lambda handlers return a consistent `{ error: { code, message } }` shape with user-safe messages; never leak raw AWS errors.
- Log structured JSON to CloudWatch with the request ID.
- Frontend shows failures inline where the user acted.

## Infrastructure as Code

All AWS infrastructure is managed with AWS CDK in `infra/` — no ClickOps.

- **Stacks**: data (DynamoDB, S3), API (API Gateway, Lambdas), live (IVS stages config, chat, recording), schedules (EventBridge).
- **Deploy**: `bunx cdk diff` before every `bunx cdk deploy`.
- **Never** create or change AWS resources in the console. Every change goes through CDK so it is version-controlled and reproducible.

## Browser Automation

**Do not run any browser automation (playwright-cli or claude-in-chrome) unless the user explicitly asks for it.** Verify changes with type-check, lint, tests and `cdk synth`, and let the user check the UI.

When the user does ask, use the `/playwright-cli` skill (screenshots, clicking, form filling). Never use claude-in-chrome MCP tools.

## Git Conventions

- Commit messages must be at most 2 sentences/phrases long.
- Commit and push to GitHub after each meaningful file or logical unit of work is complete.

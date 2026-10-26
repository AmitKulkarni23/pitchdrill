# PitchDrill

A two-minute sales drill arena. Anyone can book a seat as a seller or a buyer, get matched in a live split-screen round, and try to close (or refuse) a deal in 2 minutes while an audience watches, votes and comments.

## What It Does

Each day has scheduled time slots. People book a slot as a seller or a buyer with a public handle — no signup — and receive a private ticket link that proves the booking is theirs. Within a slot, sellers and buyers are paired first-come-first-serve at booking time, and every pair gets its own round. All rounds in a slot run in parallel; spectators pick which one to watch. Just before the round, both sides get an LLM-generated brief: the seller sees a product sheet, the buyer sees a hidden persona (budget, doubts, reasons to say no). The round runs for 2 minutes on a split screen. Spectators watch live, chat, and vote "Sold" or "Not sold" at the buzzer. The recording stays up for replay, votes and comments.

## Design Principles

- **Zero friction**: No login, no signup. A handle and a ticket link are all you need.
- **Two minutes, no more**: The constraint is the product. Rounds are short, sharp and repeatable.
- **Asymmetric information**: Seller and buyer get different briefs, so every round has real tension.
- **Practice in public**: Live audience, replays, votes and comments are how people improve.
- **Watch before you book**: the home shows live rounds and every past round; booking is one click away, never the only door.
- **Flow**: Land on home (watch live or past rounds) → Pick slot → Book as seller or buyer (handle) → Get ticket link + opponent → Join arena → Read brief → 2-minute round → Votes + comments.

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
├── docs/
│   ├── mvp.md                # Product decisions and open questions
│   ├── TASK_SPEC_TEMPLATE.md # Template for new task specs
│   ├── system_specs/         # architecture.md (block diagrams, API, lifecycle), data_model.md
│   └── task_specs/           # TASK_INDEX.md + backend/, frontend/, infra/ task specs
├── PRODUCT.md                # Product context for design work (impeccable)
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

DynamoDB single table `pitchdrill-main` (full layout in `docs/system_specs/data_model.md`). Core entities: `slots`, `bookings`, `rounds`, `votes`, `comments`, `reports`. A slot is a scheduled start time. A booking holds a slot, a role (seller/buyer), the booker's public handle and the SHA-256 hash of their ticket — never the raw ticket. A round pairs one seller booking with one buyer booking in a slot and links to its IVS stage, chat room, generated briefs, recording location and vote tallies. Votes are keyed by `roundId + voterId` (one per browser). Comments belong to a round.

## Key Behaviors

- No accounts. Identity is a public handle plus a private ticket (random token) returned once at booking, shown as a link and saved in localStorage.
- Slots run every 15 minutes, 4:00–8:45 PM `America/Los_Angeles` (20 per day). Slot IDs are UTC ISO start times; the frontend shows local time.
- Slots are bookable from 7 days ahead until 5 minutes before start.
- Handles are 3–20 letters, numbers or underscores, unique per slot (case-insensitive, either role).
- A slot holds at most 4 rounds: 4 seller seats and 4 buyer seats, enforced in the booking transaction (`409 slot_full`). Pairing is first-come-first-serve at booking: a new booking is paired with the oldest unpaired booking of the opposite role in that slot, creating a round. Pairing uses a conditional write so one booking is never paired twice.
- Unpaired bookings wait; if still unpaired at slot time they are told no opponent was found.
- All rounds in a slot start together; the arena page lists live rounds for spectators to pick from.
- Briefs are generated via OpenRouter when a round is paired and revealed to each side 5 minutes before the round; the IVS stage opens 2 minutes before and players can join from 1 minute before. The buyer's persona is never shown to the seller.
- Rounds are 2 minutes, enforced server-side. Spectators watch live and vote "Sold" / "Not sold" at the buzzer.
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
cd frontend && bun run typecheck
cd frontend && bun run test      # bun test on src/lib
```

### Backend

```bash
cd backend && bun install
cd backend && bun run typecheck
cd backend && bun run build        # bundles handlers to backend/dist (infra runs this on synth)

# Tests run against DynamoDB Local (OrbStack/Docker must be running)
docker run -d --rm --name pitchdrill-ddb -p 8000:8000 amazon/dynamodb-local
cd backend && bun run test:local

# Local API on :4000 against DynamoDB Local (IVS/OpenRouter are real, via your AWS profile).
# Starts the pitchdrill-ddb container and creates the table if either is missing; existing data is kept.
cd backend && bun run dev
cd backend && bun run dev:table                     # wipe and recreate the local table
curl -X POST "localhost:4000/dev/tick?now=<iso>"   # run SlotTick at any time
```

### Infra (AWS CDK)

```bash
cd infra && bun install
cd infra && bunx cdk synth
cd infra && bunx cdk diff
cd infra && bunx cdk deploy --all   # deploys to the default AWS profile's account, us-west-2
```

Deployed API (stack output `PitchDrillApiUrl`): `https://4yyqqe2zwj.execute-api.us-west-2.amazonaws.com`. Public routes are open (no authorizer, CORS limited to localhost:3000 and the Vercel domain); admin routes need IAM (SigV4). Replays are served from the `PitchDrillRecordingsCdnDomain` output. Call an admin route:

```bash
eval "$(aws configure export-credentials --format env)"
curl --aws-sigv4 "aws:amz:us-west-2:execute-api" --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  ${AWS_SESSION_TOKEN:+-H "x-amz-security-token: $AWS_SESSION_TOKEN"} \
  -X POST https://4yyqqe2zwj.execute-api.us-west-2.amazonaws.com/admin/rounds/<roundId>/hide
```

Admin routes are `POST /admin/rounds/<roundId>/hide` and `/end`. Recent reports (newest first) come straight from DynamoDB:

```bash
aws dynamodb query --region us-west-2 --table-name pitchdrill-main --key-condition-expression 'PK = :p' \
  --expression-attribute-values '{":p":{"S":"REPORTS"}}' --no-scan-index-forward --max-items 20
```

OpenRouter key (set by the user, never in chat or Git): `aws secretsmanager put-secret-value --region us-west-2 --secret-id pitchdrill/openrouter-api-key --secret-string '<key>'`. Without it, rounds get canned briefs from `backend/src/lib/fallbackBriefs.ts`.

Contact-form address (set by the user before the first deploy that includes it, never in Git): `aws ssm put-parameter --region us-west-2 --name /pitchdrill/contact-email --type String --value '<email>'`. SES emails it a verification link on deploy; the form sends once it's clicked. Locally, export `CONTACT_EMAIL_ENV` before `bun run dev` to send real mail.

Slack alerts: authorize the Slack workspace once in the AWS Chatbot console (no API for it), then set `SLACK_WORKSPACE_ID`, `SLACK_CHANNEL_ID` (alarms) and `SLACK_BOOKINGS_CHANNEL_ID` (one message per booking) in `infra/lib/backend-stack.ts`. Until then alarms only reach SNS `pitchdrill-alerts`. CloudWatch dashboard: `pitchdrill`.

CloudWatch RUM: set Vercel production env `NEXT_PUBLIC_RUM_APP_MONITOR_ID` to the `PitchDrillRumAppMonitorIdOutput` stack output, then redeploy the frontend. Unset (locally, previews) means RUM is off.

A failed *first* create strands the retained `pitchdrill-main` table; delete it (deletion protection off first) before redeploying.

### Vercel

Project `pitchdrill` (scope `amits-projects-684cec17`), root directory `frontend`, Bun install/build, `NEXT_PUBLIC_API_URL` set for production + preview. Deployment protection is Vercel Authentication on all deployments except custom domains (there are none), so nothing is public. Connected to GitHub: pushes to `master` deploy production, other branches deploy previews. `pitchdrill.vercel.app` is an unrelated site, not ours.

```bash
vercel deploy                              # protected preview from the repo root
vercel ls pitchdrill                       # deployments
vercel project protection pitchdrill --json
```

## Design System

The visual system is **Study Hall**: a calm, light learning app (online-chess-archive feel), documented in `DESIGN.md` with product context in `PRODUCT.md`; surface strategy lives in `.impeccable/surfaces/`. Design work goes through the impeccable skill. Approved home mockup: https://claude.ai/artifact/URDQkpThdn3PB9Szwqn8VD

- **Tokens**: `frontend/src/config/tokens.ts` (`hall` palette, `panel`, `font`; plain module, safe for server components). Never import tokens from `theme.ts` (a `"use client"` module) in server components: the values arrive as empty client references.
- **MUI theme**: `frontend/src/config/theme.ts`; components use MUI with `sx` props, no CSS Modules, no Tailwind.
- **Home components**: `frontend/src/components/home/` (SiteHeader, HomeBoard, PlayPanel, HowItWorks).
- **Round pages**: `/t#<ticket>` (ticket + participant arena; the ticket is in the URL fragment so it never reaches servers, logs or analytics; `proxy.ts` redirects old `/t/<ticket>` links), `/r/[roundId]` (watch, votes, replay, comments); shared pieces in `frontend/src/components/round/` (StageVideo over IVS Real-Time, ChatPanel over IVS Chat, VotePanel, CommentsPanel, ReplayVideo with hls.js). Built functional-first; visual polish still to go through impeccable.

## Architecture

- **No API routes on Vercel.** Next.js is the frontend only. All data access goes through the AWS API (API Gateway → Lambda → DynamoDB).
- **IVS Real-Time** for the seller/buyer split screen, one stage per round; spectators subscribe with view-only tokens. Composite recording goes to S3.
- **IVS Chat** for live comments during a round; every chat message is saved to DynamoDB as a comment by an IVS Chat review handler, alongside replay comments.
- **OpenRouter** for product briefs and buyer personas, called only from Lambda (key in Secrets Manager when added).
- **EventBridge Scheduler** opens stages before a slot and closes them after the round.

## Security Model

- Raw tickets are returned once at booking and never stored; DynamoDB keeps only their SHA-256 hash. Tickets are looked up by hash key, never compared in app code.
- IVS publish tokens are minted only for the seller/buyer holding a valid ticket for that round. Spectators get subscribe-only tokens.
- Briefs are served per side: each brief endpoint requires that side's ticket.
- AWS access lives in Lambda IAM roles granted with `.grant*()`, never in the frontend. Services without grant methods (IVS) get `addToRolePolicy` scoped to exact actions and resources, with a comment.
- Admin routes use API Gateway IAM (SigV4) auth; public routes have no authorizer.
- API Gateway HTTP API per-route throttles (all users combined, not per IP — HTTP APIs don't support WAF). Limits in `docs/system_specs/architecture.md`.
- CORS allows `http://localhost:3000` and the Vercel production domain `https://pitchdrill-azure.vercel.app`. The site is public (US only, `frontend/src/proxy.ts`).

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

## Specs and Tasks

- **Architecture**: `docs/system_specs/architecture.md` (block diagrams, AWS components, decisions, round lifecycle, API, flows). **Data model**: `docs/system_specs/data_model.md`. Read both before any backend or infra change and keep them current.
- **Tasks**: `docs/task_specs/TASK_INDEX.md` lists every task in order. Work on the first task that is not struck through and whose dependencies are done; follow its spec exactly.
- **When a task is done** (all acceptance criteria met), strike its line through in `docs/task_specs/TASK_INDEX.md` (`~~...~~`) and commit that with the task's last change.
- New tasks use `docs/TASK_SPEC_TEMPLATE.md` and get a line in the index.
- Steps marked **asks the user** / **requires user approval** in a spec are hard stops: ask and wait.

## Git Conventions

- Commit messages must be at most 2 sentences/phrases long.
- Commit and push to GitHub after each meaningful file or logical unit of work is complete.

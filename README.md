# PitchDrill

A two-minute sales drill arena. See `CLAUDE.md` for the product, architecture and all commands.

## Run locally

The frontend calls the local API at `http://localhost:4000` (`frontend/.env.development.local`), so run both, in two terminals. OrbStack/Docker must be running.

```bash
cd backend && bun install && bun run dev    # API on :4000, starts DynamoDB Local on :8000
cd frontend && bun install && bun run dev   # app on :3000
```

If the app says "Can't reach PitchDrill right now", the backend isn't running.

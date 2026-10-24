# Task: 022 — Slack alerts, dashboard, US-only website, Contact Us

## Summary

Send every alarm to Slack through SNS + AWS Chatbot, add a CloudWatch dashboard, show non-US visitors a Coming soon page, and add a Contact Us form that emails the owner through SES. Decisions (user, 2026-10-23): Chatbot over a webhook Lambda (both $0; nothing to maintain), website-only geo gate, dashboard in CDK, contact address only in SSM. See `docs/system_specs/architecture.md` §2, §5, §8, §9.

## Requirements

1. Every CloudWatch alarm MUST notify SNS `pitchdrill-alerts` on ALARM and OK; a Chatbot Slack channel configuration MUST subscribe to it once `SLACK_WORKSPACE_ID` / `SLACK_CHANNEL_ID` are set. Chatbot's guardrail MUST be read-only.
2. A `pitchdrill` dashboard MUST show the business metrics, API traffic/errors/latency, alarm status and Lambda errors.
3. `proxy.ts` MUST rewrite page requests whose `x-vercel-ip-country` isn't `US` to `/coming-soon`; assets MUST pass.
4. `POST /contact` MUST validate name (1–60), email, message (1–2000), drop honeypot hits with a 201, and send via SES from/to the SSM address with Reply-To the sender. The address MUST NOT be in Git.
5. The header MUST link to `/contact`.

## Dependencies

- None

## Files to Create/Modify

- `backend/src/handlers/createContact.ts`, `backend/test/contact.test.ts` (create); `backend/src/routes.ts` (modify)
- `infra/lib/backend-stack.ts` (modify)
- `frontend/src/proxy.ts`, `frontend/src/components/home/SiteHeader.tsx` (modify); `frontend/src/app/contact/page.tsx`, `frontend/src/app/coming-soon/page.tsx`, `frontend/src/components/ContactForm.tsx` (create)

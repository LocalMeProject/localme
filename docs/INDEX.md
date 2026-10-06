---
id: repo:localme/docs/index
title: LocalMe Global Documentation Map
level: repo
kind: index
---

# LocalMe Global Documentation Map

| Domain | Description |
|---|---|
| auth | Authentication, visitor sessions, API keys, roles |
| projects | Project workspaces, static files, route rewrites |
| platform | Platform infrastructure, reverse proxy, secrets, cron, webhooks |
| data | Document database (JSON) and file storage APIs |
| culture | Multi-culture layer (RTL, Shamsi calendar, translation) |

## Flows

- `auth:visitor-login` — Visitor captcha and login session flow
- `auth:admin-first-boot` — First-boot administrator creation
- `project:upload` — Uploading static assets and minification
- `domain:ssl-provision` — ACME HTTP-01 SSL provisioning
- `webhook:delivery` — Webhook outbox and retries
- `project:export` — Project workspace backup and ZIP export

## Cross-Domain Participation

- Platform cron triggers `domain:ssl-provision`.
- Webhooks trigger from `data` events.

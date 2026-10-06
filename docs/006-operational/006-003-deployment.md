---
id: repo:localme/operational/deployment
parent: repo:localme/operational
title: Deployment
level: repo
kind: runbook
domains:
  - platform
keywords:
  - deploy
  - runflare
  - container
  - docker
---

# Deployment

LocalMe is built to run on bare-metal servers, Docker containers, or container platforms (e.g., Runflare).

## Smart Container Startup
Container platforms expect port 3000 to be open within a startup grace period.

- **Command**: `npm run runflare:start` (or `node scripts/runflare-start.mjs`)
- **Behavior**: Instead of running redundant `npm install` and `next build` steps during the start phase, it assumes `.next` exists. It immediately runs database migrations (`scripts/migrate.mjs`) and starts the Next.js server in under 2 seconds to avoid `SIGTERM` healthcheck timeouts.

## Single-Volume Setup
For persistent storage:
```env
STORAGE_DATA_DIR="/app/storage_data"
DB_PATH="file:/app/storage_data/localme.db"
```
Ensure this directory is mounted as a persistent volume. This keeps both project assets and the SQLite DB intact across container restarts.

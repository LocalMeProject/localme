# ADR 010 — Container Runtime Resilience, Single-Volume Storage and Dynamic Platform Configuration

- Status: accepted
- Date: 2026-10-04
- Refines: §2 (tech stack), §4 (database/storage), §10 (tiers/quotas), §16 (operations).

## Context

Deploying LocalMe to modern container environments (such as Runflare, Docker, Railway, or Kubernetes) introduced three operational challenges:

1. **Container Startup Probe Timeouts (`SIGTERM`)**:
   Standard deployment chains configured as `npm install && npm run build && npm run db:migrate && npm run start` executed full dependency installation and Next.js compilation inside the runtime container. On a production container, compiling Next.js takes 2 to 4 minutes. Because Runflare's orchestrator expects port `3000` to respond within a startup grace period (60–120s), the closed port caused the orchestrator to mark the container unhealthy and terminate it with `SIGTERM`.
2. **Persistent Storage Sizing on a Single Volume**:
   Container platforms frequently offer a single attached persistent volume (e.g. 2GB). Storing user files on disk while maintaining a separate database file risked either silent data loss on container recreation or volume mounting conflicts.
3. **Dynamic Subscriptions and Payment Gateways**:
   Subscription tiers (Free, Plus, Pro) and pricing models could not remain static hard-coded constants. SuperAdmins require the ability to define tier names, prices, and storage quotas at runtime. Additionally, ZarinPal deprecated its legacy sandbox environment, requiring direct production merchant ID configuration in the console rather than mandatory environment variables.
4. **User Profile Governance**:
   Users needed a self-service profile page to update their display name and profile details, while ensuring foundational identity fields (username and phone number) remain strictly immutable.

## Decision

### 1. Smart Container Startup Entrypoint (`scripts/runflare-start.mjs`)
We introduced `scripts/runflare-start.mjs`, invoked by `npm run runflare:start` and `npm run runflare:deploy`:
- **Filesystem Introspection**: Checks if `node_modules` and `.next` already exist from the build phase. If present, it skips redundant installation and compilation entirely.
- **Automated Directory & Schema Migrations**: Runs `node scripts/migrate.mjs`, which automatically creates database directories recursively and applies pending migrations idempotently.
- **Sub-2-Second Port Binding**: Launches the Next.js production server directly on `0.0.0.0:${PORT:-3000}` in under 2 seconds, immediately passing Runflare health probes.
- **Graceful Lifecycle Hooks**: Traps `SIGTERM` and `SIGINT` signals, passing them to the child process for clean connection draining and database flush.

### 2. Consolidated Single-Volume Storage Strategy
To optimize single-volume deployments (e.g. 2GB):
- The persistent volume is mounted to `/app/storage_data`.
- Environment variables are configured as:
  ```env
  STORAGE_DATA_DIR="/app/storage_data"
  DB_PATH="file:/app/storage_data/localme.db"
  ```
- Both uploaded assets (which consume ~85–95% of disk space) and the SQLite database (which consumes ~5–15%) coexist securely within the same persistent volume, fully surviving container redeployments and restarts.
- For local or standalone servers where `DB_PATH` is left unset in non-test mode, SQLite now defaults to persistent `data/localme.db` rather than ephemeral `:memory:`.

### 3. Dynamic Multi-Tier Subscriptions (Free, Plus, Pro)
- Subscription tiers are stored in `system_configs` (`subscription.tiers`) as JSON records defining tier names, monthly prices, project limits, and storage quotas.
- SuperAdmins can modify tier names, prices, and features directly via `/admin/settings`.
- Changes trigger immediate in-memory cache eviction, instantly updating the public pricing tables on the marketing landing page and the user upgrade modals.

### 4. Direct ZarinPal Gateway Configuration
- Eliminated deprecated sandbox mode code.
- Gateway configuration in `lib/server/zarinpal.ts` queries `system_configs` (`zarinpal.merchant_id`) before falling back to environment variables.
- SuperAdmins can input and update their live ZarinPal Merchant ID directly from the admin console without container restarts.

### 5. Profile Editing & Immutable Identity
- Introduced `/profile` and dashboard profile management allowing users to update display names and biographical information.
- Enforced strict immutability on `username` and `phone` fields to preserve audit logs, project URL bindings, and authentication integrity.

## Consequences

- Runflare and Docker container deployments launch in seconds without timing out.
- A single 2GB persistent volume reliably stores all application state and user uploads.
- Operators can adjust commercial pricing and tier definitions on the fly without redeployment.
- User identity remains tamper-proof across the platform.

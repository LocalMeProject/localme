---
id: repo:localme/decisions/operational-hardening
parent: repo:localme/decisions
title: Operational Hardening
level: repo
kind: decision
date: 2026-10-01
deciders: [architecture-team]
---
# ADR 004 — Operational hardening: logging, caching, write ordering, outbox, ACME, backups

- **Status:** Accepted
- **Date:** 2026-09-30
- **Supersedes:** nothing
- **Related:** [ADR 001](./001-nextjs-only-architecture.md),
  [ADR 002](./002-postgres-neon-db-backed-storage.md),
  [ADR 003](./003-sqlite-first-switchable-postgres.md),
  [ADR 005](./005-editor-hashing-and-watermark.md),
  [audit-2026-09-30](../audit-2026-09-30.md)

## Context

The first two implementation passes built the documented feature surface, but several parts of
the Technical Documentation describe *operational* behaviour — structured logging (§9.4), bounded
asset caching with conditional requests (§8.1), serialized writes (§8.4), minification on save
(§8.3), webhook delivery semantics (§5.9), certificate lifecycle (§5.6) and backups (§9.3) — that
had no counterpart in the Next.js codebase. The 2026-09-30 audit listed them as gaps.

This ADR records how each was implemented, and the places where the implementation deliberately
does not match the spec's letter.

## Decision

### 1. Structured logging without a logging dependency (§9.4)

`lib/server/logger.ts` writes newline-delimited JSON: one level threshold
(`logging.level`), one sink (`stdout` or `logging.file_path`), scoped names via `createLogger()` /
`child()`. The .NET original used Serilog with a file sink; NDJSON on stdout is the container-native
equivalent and needs no agent or sidecar.

Redaction happens before a record is written, never after. A field is redacted when any
`[^a-z0-9]+`-separated segment of its camelCase-normalized name is in the sensitive set — so
`password`, `apiKey`, `x-api-key` and `STRIPE_KEY` are all caught while `monkey` is not. Values
longer than 512 characters are truncated with a marker, and anything shaped like a JWT is redacted
even under an innocent key. The logger is the only module allowed to touch the console; every
`console.error` in the request path was replaced.

### 2. Asset cache is in-process, bounded and invalidated on write (§8.1)

`lib/server/asset-cache.ts` is an LRU byte cache with a TTL, capped by total bytes. It is
deliberately *not* shared between instances: a single-node deployment (the documented default) gets
the whole benefit, and a multi-instance deployment would need a shared cache the spec never asked
for. The correctness requirement — never serve a stale asset — is met by invalidation on every
`putFile` / `deleteFile` rather than by cache coherence. HTML is never cached: it carries per-request
state (watermark, visit counting). Strong ETags plus `If-None-Match` → 304 cover the
conditional-request requirement.

### 3. Per-project write locks, not per-row transactions (§8.4)

`lib/server/write-lock.ts` is a FIFO mutex keyed by project id, applied to document insert, update
and delete. The spec asks for serialized writes; a mutex gives the same guarantee with far less
machinery than optimistic-retry loops, and different projects still run in parallel. A lock holder
that throws still releases its slot.

### 4. Minification on save is the default, and overridable (§8.3)

`storage.minify_on_save` defaults to **true** — that is what the spec describes. `?minify=0` and
`?minify=1` override it per request, so a user who needs the exact bytes can always get them.
Uploads that declare more than the 10 MB ceiling in `Content-Length` are rejected with 413 before
the body is buffered.

### 5. Webhook outbox, with retries off (§5.9)

Deliveries are enqueued in `webhook_outbox` (migration 005) and drained inline after the
triggering request completes, so a slow or failing receiver never blocks the user's `POST
/api/db/insert`. `webhooks.retry_failed` defaults to **false** because the spec states
"Retry: No retries" under the webhook table; the retry budget (`webhooks.max_attempts`,
`webhooks.retry_backoff_seconds`) exists for operators who want to turn it on, and
`retry_failed_webhooks` drains the queue when they do.

### 6. ACME is implemented but opt-in, and staging-first (§5.6)

`lib/server/ssl.ts` implements HTTP-01 challenge storage, issuance, storage and renewal, with the
ACME client injected so tests can substitute an issuer. `ssl.auto_provision` defaults to **false**:
a platform that quietly talks to a public CA, and can quietly be rate-limited by it, is not a
sensible default. `ssl.acme_staging` defaults to **true** so the first operator who enables
provisioning is not burning Let's Encrypt production limits. Challenges are served from
`/.well-known/acme-challenge/`, which `middleware.ts` passes through before custom-domain rewrites.
The new `renew_ssl_certificates` cron task runs every six hours but no-ops while the switch is off.

### 7. Backups are a CLI tool, not an endpoint (§9.3)

`scripts/backup.mjs` (`bun run backup`) uses `pg_dump` for Postgres and `VACUUM INTO` (with a file
copy fallback) for SQLite, then prunes past the retention window. It takes `--db`, `--dir`,
`--driver`, `--retention-days`, `--list`, `--verify` and `--restore` flags rather than reading the
environment inline, so the same snapshot runs from cron, a systemd timer or CI. The Postgres
connection string comes from `DATABASE_URL` and is never passed as an argument, where it would
land in the process list and shell history.

### 8. Spec-mandated path aliases are thin delegations (§6.3, §6.4)

`/api/api-endpoints` and `/admin/api/{users,projects,system-configs,global-cron,stats}` exist
because the spec names those paths. They re-export the same handlers as the endpoints the console
uses, so there is exactly one implementation per operation.

## Consequences

- **Positive:** the audit's operational gaps are closed and directly tested
  (`tests/server/operations.test.ts`, 19 tests); migrations 005 and 006 exist in both dialects and
  the Postgres ledger test proves they apply.
- **Accepted costs:** the asset cache is per-instance, so a scaled deployment pays the same DB read
  per instance for a cold asset. Document writes to one project serialize, which is a throughput
  ceiling for a single hot project.
- **Behavioural differences from the spec's letter, all deliberate:** minify-on-save is
  overridable; webhook retries are off by default; ACME is off by default and staging-first;
  `ssl.auto_provision` must be enabled before the certificate endpoints will order anything.
- **Rejected alternatives:** a logging library (Serilog's Node ports bring sinks we do not
  configure), Redis for the asset cache (a new hard dependency for a single-node default), and
  exposing backup over HTTP (writes a file to the host from a request handler).



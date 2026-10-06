# ADR 002: PostgreSQL via Neon; DB-backed file storage

**Status:** Accepted
**Date:** 2026-09-19

## Context

The Blueprint assumes a single Ubuntu server with a local PostgreSQL install and files on local disk (`/var/mvp/storage/`). The actual deployment target is platform-managed hosting with **no persistent local disk** and **no shell-managed services**: a container rebuild loses everything not in the database or git.

Constraints verified in the build environment:
- No local Postgres, no Docker, no persistent volume guarantees.
- The owner's key (`DATABASE_URL`, Neon) is already provisioned in the environment.

## Decision

1. **Database:** PostgreSQL, connection string from `DATABASE_URL`. Compatible with any Postgres 14+ (Neon, RDS, self-hosted). Neon's pooled connections suit serverless-style route handlers; schema is created by a migration script (`npm run db:migrate`), runnable locally or in CI.
2. **File storage (deviation from `/var/mvp/storage`):** Project files are stored **in Postgres** (`file_blobs` table, `bytea`), not on local disk. Rationale: local disk is ephemeral on the target; Postgres is the one durable store we are guaranteed. Caps and quota logic are unchanged (the cap check is a byte-sum query either way). For a future self-hosted single-server deployment, swap the storage adapter to disk (the Blueprint's `IStorageProvider` seam is preserved as a TS interface).
3. **Migrations:** Plain SQL files in `db/migrations/`, applied in lexicographic order by a small Node runner with a `schema_migrations` ledger table. No ORM, matching the Blueprint's "no heavy abstraction" principle.
4. **Sessions/rate limits/cron state:** all in Postgres per the Blueprint ("database-backed persistence") — this also makes the app restart-safe on ephemeral containers.

## Consequences

- Backups = standard Postgres dumps; file export = the Blueprint's ZIP export over `file_blobs`.
- Blob reads/writes are bounded by the documented 5 MB default cap and 10 MB max upload — Postgres `bytea` handles this comfortably (TOAST compresses in-line).
- Neon free tier is sufficient for MVP-scale traffic; connection string is the only secret the app needs at runtime (plus `SESSION_SECRET` for HMAC, generated at deploy time).

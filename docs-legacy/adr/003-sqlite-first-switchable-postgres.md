# ADR 003: SQLite-first data layer with switchable Postgres (Drizzle ORM)

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** Project owner (directive: "Use SQLite database with the ORM of your choosing … but have full implementation for Postgres as well ready to be switched to so later I can switch them for production")

## Context

ADR 002 fixed Postgres (Neon) as the only store, with raw parameterized SQL and no ORM.
Two later directives change the constraints:

1. Tests must run in CI, not the sandbox — an engine that boots instantly in CI
   (no service container) makes every data-layer test cheap and hermetic.
2. The owner wants a production-ready Postgres path that can be switched on later
   without a rewrite.

## Decision

1. **ORM:** Drizzle ORM. It stays close to SQL (the Blueprint's "no heavy abstraction"
   principle survives as "no query-building magic"), is fully typed, and ships first-class
   drivers for both `better-sqlite3` and `node-postgres` — the exact pair we need.
2. **Default dialect: SQLite** (`DB_DRIVER=sqlite`, the default). In-memory (`:memory:`)
   unless `DB_PATH=file:…` is set. Zero-dependency local dev and CI.
3. **Postgres remains fully implemented** (`DB_DRIVER=postgres` + `DATABASE_URL`):
   same schema, same query semantics, exercised in CI against a real Postgres 16
   service container (`postgres-integration` job). Switching to Postgres in production
   is a config change, not a code change.
4. **Schema lives twice on purpose** — `db/sqlite/*.sql` and `db/postgres/*.sql` are
   statement-equivalent migrations (parity map in `db/README.md`), mirrored by Drizzle
   schema definitions in `lib/server/db/{sqlite,postgres}/schema.ts`. Platform tables go
   through Drizzle's typed query builder; the per-project document store (`project_data`)
   goes through a hand-written DSL→SQL compiler (`lib/server/db/dsl.ts`) because Mongo-style
   operator semantics are the product surface, not an implementation detail.
5. **Everything behind one facade:** application code imports `getDb()` from
   `lib/server/db/index.ts` and never touches a driver package. Driver modules are loaded
   lazily, so a SQLite deployment never pulls `pg` into its runtime path and vice versa.

## Consequences

**Positive:**
- CI runs the full data-layer suite twice: once on in-memory SQLite, once on real Postgres —
  dialect drift is caught on every PR, not in production.
- Local dev and previews need no database service at all.
- The owner can flip to Neon Postgres for production by setting two env vars.

**Negative / trade-offs:**
- SQLite's typelessness around JSON means boolean/number comparisons use text/REAL casts;
  Postgres uses `jsonb` casts. Both are implemented and tested, but semantic parity for
  exotic filters is best-effort (documented in `db/README.md`).
- Schema duplication across dialect trees is manual; the parity map and CI keep it honest.
- `better-sqlite3` is a native module; the deploy host must run its install step
  (it does — standard Node hosting).

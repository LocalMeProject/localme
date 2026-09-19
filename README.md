# LocalMe

LocalMe is a Backend-as-a-Service for frontend-only applications. You write HTML, CSS and
JavaScript, upload it, and the platform provides everything else: a JSON document database, file
and asset storage, visitor accounts with roles and permissions, routing, encrypted secrets, a
reverse proxy, a shared asset library, scheduled tasks, webhooks, custom domains and usage
reporting.

The product specification lives in [`docs/`](./docs). This repository is the running
implementation: **a single Next.js (App Router) application** — the console and the platform API
live in one codebase, and every hosted project is served over HTTP by the same server. The
deviation from the Blueprint's .NET backend is recorded in
[ADR 001](./docs/adr/001-nextjs-only-architecture.md); Postgres + Neon and DB-backed file storage
in [ADR 002](./docs/adr/002-postgres-neon-db-backed-storage.md); the SQLite-first, ORM-based
data layer with a fully-switchable Postgres path in
[ADR 003](./docs/adr/003-sqlite-first-switchable-postgres.md).

---

## Stack

| Layer      | Choice                                                                     |
| :--------- | :------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19, TypeScript                   |
| UI         | Tailwind CSS, Radix primitives (shadcn/ui conventions), zustand, sonner    |
| Backend    | Next.js Route Handlers (Node.js runtime) under `app/api/`                  |
| Database   | Drizzle ORM over **SQLite by default** (`DB_DRIVER=sqlite`) — Postgres fully implemented and switchable via `DB_DRIVER=postgres` (ADR 003) |
| Files      | Blobs in the database with quota enforcement (see ADR 002)                  |
| Passwords  | scrypt (Node crypto), secrets encrypted with AES-256-GCM                   |
| Tooling    | Bun, ESLint 9 (flat config), Vitest, GitHub Actions                        |

No server-side user code is ever executed. A project is static assets plus calls to the documented
platform API.

---

## Getting started

```bash
bun install        # install dependencies
bun run dev        # Next.js dev server on 0.0.0.0:$PORT
```

Local dev needs **no database service**: the default dialect is in-memory SQLite.

```bash
bun run db:migrate                 # apply the schema (SQLite; in-memory unless DB_PATH is set)
DB_DRIVER=postgres bun run db:migrate   # ...or Postgres via DATABASE_URL
bun run test                       # data-layer + crypto tests on SQLite
bun run test:postgres              # data-layer tests on Postgres (needs DATABASE_URL)
```

Environment variables (see [`env.example`](./env.example)):

- `DB_DRIVER` — `sqlite` (default) or `postgres`
- `DB_PATH` — SQLite file path (`file:…`); unset = in-memory
- `DATABASE_URL` — Postgres connection string (required when `DB_DRIVER=postgres`)
- `SESSION_SECRET` — HMAC key for session integrity

## Repository layout

```
app/            Next.js App Router: pages, layouts and route handlers
  api/          Platform REST API (auth, db, storage, routing, ...)
  docs/         API documentation site
  page.tsx      Marketing landing page with the live in-browser demo
components/     Console and UI components (design system in components/ui)
lib/            Shared client/server code (formatting, theme, SEO)
lib/server/db/  Dialect-agnostic data layer (Drizzle + DSL compiler; see ADR 003)
db/sqlite/      SQLite migrations (default dialect)
db/postgres/    Postgres migrations (production dialect)
docs/           Product specification + ADRs
tests/          Vitest unit tests (run in CI, never as a sandbox gate)
```

## What a project gets

- `/{username}/{project}/` serving of uploaded static assets with route resolution, a
  `404.html` fallback and a watermark injection.
- `/api/db/*`, `/api/storage/*` document and file APIs scoped to the caller's project.
- Visitor accounts with project-scoped roles, and API keys hashed at rest.
- Encrypted secrets (`{{KEY}}` substitution in proxy routes), webhooks with HMAC signatures,
  and built-in cron jobs backed by the database.

## HTTP API

The full endpoint reference ships on the docs site at `/docs` (source: `app/docs/page.tsx`).
Authentication is a platform session cookie, a visitor session, or `Authorization: Bearer <API key>`.

## Verification

CI (`.github/workflows/ci.yml`) runs on every PR and on `main`:

```bash
bun run typecheck       # tsc --noEmit
bun run lint            # eslint (flat config, next/core-web-vitals + typescript)
bun run test            # vitest on in-memory SQLite
bun run test:postgres   # vitest on a real Postgres (CI service container)
bun run build           # next build
```

## Production deployment

The production host builds `bun run build` and serves the Next.js server. Recommended for
production is the Postgres dialect:

- `DB_DRIVER=postgres`, `DATABASE_URL` (Neon free tier works), `SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL` — the public origin (canonical URLs, hosted-project links, sitemap)

SQLite (`DB_DRIVER=sqlite` + `DB_PATH=file:…`) remains valid for single-node self-hosting.

---

## Operating notes

- Docs are the contract; product-behavior deviations go through `docs/adr/`.
- The working tree is kept deployable at all times; CI must pass before merge.

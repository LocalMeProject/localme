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
in [ADR 002](./docs/adr/002-postgres-neon-db-backed-storage.md).

---

## Stack

| Layer      | Choice                                                                     |
| :--------- | :------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19, TypeScript                   |
| UI         | Tailwind CSS, Radix primitives (shadcn/ui conventions), zustand, sonner    |
| Backend    | Next.js Route Handlers (Node.js runtime) under `app/api/`                  |
| Database   | PostgreSQL (Neon-compatible) via `pg` — raw parameterized SQL, no ORM      |
| Files      | `bytea` blobs in Postgres (see ADR 002) with quota enforcement              |
| Passwords  | scrypt (Node crypto), secrets encrypted with AES-256-GCM                   |
| Tooling    | Bun, ESLint 9 (flat config), Vitest, GitHub Actions                        |

No server-side user code is ever executed. A project is static assets plus calls to the documented
platform API.

---

## Getting started

```bash
bun install        # install dependencies
bun run db:migrate # apply the SQL schema (requires DATABASE_URL)
bun run dev        # Next.js dev server on 0.0.0.0:$PORT
```

Required environment variables (see [`env.example`](./env.example)):

- `DATABASE_URL` — Postgres connection string (Neon free tier works)
- `SESSION_SECRET` — HMAC key for session integrity

## Repository layout

```
app/            Next.js App Router: pages, layouts and route handlers
  api/          Platform REST API (auth, db, storage, routing, ...)
  docs/         API documentation site
  page.tsx      Marketing landing page with the live in-browser demo
components/     Console and UI components (design system in components/ui)
lib/            Shared client/server code (formatting, theme, SEO)
lib/server/     Server-only foundations (db pool, crypto)
db/migrations/  Plain SQL migrations applied by scripts/migrate.mjs
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
bun run typecheck  # tsc --noEmit
bun run lint       # eslint (flat config, next/core-web-vitals + typescript)
bun run test       # vitest
bun run build      # next build
```

## Production deployment

The production host builds `bun run build` and serves the Next.js server. Required env vars:

- `DATABASE_URL`, `SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL` — the public origin (canonical URLs, hosted-project links, sitemap)

---

## Operating notes

- Docs are the contract; product-behavior deviations go through `docs/adr/`.
- The working tree is kept deployable at all times; CI must pass before merge.

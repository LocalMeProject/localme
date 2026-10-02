# LocalMe

LocalMe is a Backend-as-a-Service for frontend-only applications. You write HTML, CSS and
JavaScript, upload it, and the platform provides everything else: a JSON document database, file
and asset storage, visitor accounts with roles and permissions, routing, encrypted secrets, a
reverse proxy, a shared asset library, scheduled tasks, webhooks, custom domains and usage
reporting.

This repository is the running implementation: **a single Next.js (App Router) application** — the
console and the platform API live in one codebase, and every hosted project is served over HTTP by
the same server. The product specification lives in [`docs/`](./docs) (Blueprint, Technical
Documentation, User Guide), alongside the architecture decision records and the implementation
audit; the shipped HTTP contract is documented at [`/docs`](./app/docs/page.tsx). The deviation from the Blueprint's .NET backend is
recorded in
[ADR 001](./docs/adr/001-nextjs-only-architecture.md); Postgres + Neon and DB-backed file storage
in [ADR 002](./docs/adr/002-postgres-neon-db-backed-storage.md); the SQLite-first, ORM-based
data layer with a fully-switchable Postgres path in [ADR 003](./docs/adr/003-sqlite-first-switchable-postgres.md); the operational pass
(structured logging, asset caching, write serialization, minify-on-save, webhook outbox, ACME and
the backup tool) in [ADR 004](./docs/adr/004-operational-hardening.md); the editor, password
hashing and watermark deviations in [ADR 005](./docs/adr/005-editor-hashing-and-watermark.md);
the optional `SESSION_SECRET` and the first-boot administrator in
[ADR 006](./docs/adr/006-optional-session-secret-and-first-boot-admin.md); the
library as a reserved per-user CDN namespace, visitor sessions as first-class API
principals, and the forwarded-host hotlink comparison in
[ADR 007](./docs/adr/007-library-as-a-reserved-cdn-namespace.md); the
two-culture layer — RTL, the Shamsi calendar, Persian digits and runtime-editable
wording — in [ADR 008](./docs/adr/008-multi-culture-rtl-and-shamsi-calendar.md).

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
| Cultures   | `fa-IR` (default, RTL, Shamsi, Persian digits) and `en-US` — see ADR 008 |
| Tooling    | Bun, ESLint 9 (flat config), Vitest, GitHub Actions                        |

No server-side user code is ever executed. A project is static assets plus calls to the documented
platform API.

---

## Getting started

```bash
bun install        # install dependencies
bun run dev        # Next.js dev server on 0.0.0.0:$PORT
```

Everything at once — install, verify, build, run:

```bash
bun install && bun run typecheck && bun run lint && bun run test && bun run build && bun run start
```

Local dev needs **no database service**: the default dialect is in-memory SQLite,
and the in-memory database is migrated automatically on first connection, so
`bun run dev` works from a clean checkout.

```bash
bun run db:migrate                 # only needed for a file-backed DB (DB_PATH) or Postgres
DB_DRIVER=postgres bun run db:migrate   # Postgres, via DATABASE_URL
bun run test                       # data-layer + crypto + platform tests on SQLite
bun run test:postgres              # data-layer tests on Postgres (needs DATABASE_URL)
bun run seed                       # demo accounts and projects (see below)
bun run backup -- --help           # snapshot / verify / restore the database
```

Environment variables (see [`env.example`](./env.example)):

- `DB_DRIVER` — `sqlite` (default) or `postgres`
- `DB_PATH` — SQLite file path (`file:…`); unset = in-memory
- `DATABASE_URL` — Postgres connection string (required when `DB_DRIVER=postgres`)
- `SESSION_SECRET` — HMAC key for session integrity + secret encryption.
  **Optional**: when unset the platform generates a secret on first boot and
  stores it in `system_configs` (`platform.session_secret`), so a fresh install
  works with no configuration. Set it explicitly for production.
- `NEXT_PUBLIC_SITE_URL` — public origin (platform host detection, canonical URLs)
- `PLATFORM_CRON_TOKEN` — shared token the cron runner presents to `/api/cron/run`
  (`x-cron-token`) to execute every due task across projects; without it, cron
  tasks only run when a project explicitly asks for them
- `ALLOWED_DEV_ORIGINS` — comma-separated hosts allowed to load `/_next/*` from
  `next dev` (see below)
- `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD` /
  `ALLOW_DEFAULT_ADMIN_PASSWORD` — first-boot administrator (see below)

### First boot

A deployment with **zero users** cannot reach `/admin`, because every operator
surface requires a signed-in administrator. So on the first request to
`/health` against an empty database the platform creates one administrator:

| Variable | Default | Notes |
| :------- | :------ | :---- |
| `ADMIN_INITIAL_USERNAME` | `admin` | the account it creates |
| `ADMIN_INITIAL_PASSWORD` | `admin1234` | set your own for any real deployment |
| `ALLOW_DEFAULT_ADMIN_PASSWORD` | unset | set to `1` to accept `admin1234` in production |

It runs **once** — the moment anyone signs up it never fires again — and it is
refused outright in production unless you explicitly allow the default password,
so a deployment cannot end up sitting on a published credential because nobody
read the README. Change the password from the admin console after signing in.

### Console roles

Two tiers, both reachable at `/admin`:

- **Operator** — runs the platform day to day: every account and project,
  suspend/unlock, impersonate ordinary users, configuration, cron, the shared
  library. Cannot change roles, delete accounts, delete projects, or impersonate
  another admin.
- **Admin** — everything an operator can do, plus those four.

The console hides the admin-only controls from an operator rather than offering
buttons that come back `403`.

### Development behind a proxy or tunnel

`next dev` answers **403** for its own `/_next/*` resources when the request comes
from a host it does not recognise, and the workspace preview is served from a
per-workspace subdomain rather than `localhost`. When that happens the HTML still
renders — the page simply never hydrates, so every button, link and toggle is
inert while the markup looks perfect. `next.config.ts` allowlists `localhost`,
`127.0.0.1` and the preview proxy domain for this reason; add anything else you
serve the dev server from through `ALLOWED_DEV_ORIGINS` (wildcards allowed):

```bash
ALLOWED_DEV_ORIGINS="*.example.com,tunnel.localhost" bun run dev
```

`next build` / `next start` serve no dev resources, so this only affects `bun run dev`.

## Demo data

`bun run seed` fills a development database with something to click through: five
accounts, six projects, documents, files, domains, webhooks, API keys and two months
of visit analytics.

```bash
bun run seed                 # idempotent — an existing account is left alone
bun run seed -- --reset      # delete the demo accounts first, then recreate
```

All five accounts share the password **`demopassword`**:

| Username | Role | Projects |
| :------- | :--- | :------- |
| `ada` | user | `atlas-dashboard` (orders + tickets, a `requires_auth` page, a proxy route), `field-notes` |
| `grace` | operator | `orbit-store` (operators can sign in to `/admin`) |
| `linus` | user | `kernel-blog`, `archive-2019` (seeded suspended, so serving answers 403) |
| `margaret` | user | `compiler-playground` |
| `admin` | admin | — (the operator console) |

Each project gets an API key, printed once at the end of the run. Console login is
captcha-gated (§7.2), so a scripted login has to fetch `/auth/captcha` first and read
the sum out of the SVG.

Two things to know:

- **The seeder targets whatever `DB_PATH`/`DATABASE_URL` point at.** With the default
  in-memory database it creates rows and throws them away when the process exits —
  point `DB_PATH` at a file first if you want the demo to survive.
- **It refuses to run when `NODE_ENV=production`** unless you pass
  `--allow-production`. Demo accounts share a published password; that must never be
  true of a deployment someone is using.

## System configuration

Most runtime behaviour is a **system config row**, editable at `/admin/settings` or through
`/api/admin/config` — no redeploy. The keys this pass added:

| Key | Default | Effect |
| :-- | :------ | :----- |
| `storage.minify_on_save` | `true` | Strip comments and dead whitespace from CSS/JS/JSON/HTML/SVG on upload. `?minify=0` overrides per request. |
| `serving.hotlink_protection` | `true` | Enforce Referer/Origin on assets. Turn off for legitimate cross-origin embeds. |
| `watermark.label` / `watermark.url` | §14 default | Label and link in the injected watermark. Empty = the documented `MVP Platform` / `mvp.com` markup; set both to brand the badge. |
| `logging.level` | `info` prod / `debug` dev | Threshold for the structured logger (`debug`, `info`, `warn`, `error`). |
| `logging.sink` | `stdout` | `stdout` (NDJSON per line) or `file`. |
| `logging.file_path` | — | Destination file when `logging.sink` is `file`. |
| `webhooks.retry_failed` | `false` | Spec §5.9 says "Retry: No retries"; retries stay opt-in. |
| `webhooks.max_attempts` / `webhooks.retry_backoff_seconds` | `5` / `60` | Outbox retry budget when retries are on. |
| `webhooks.allow_private_targets` | `false` | Allow webhooks to reach private/loopback addresses. Off by default: server-side fetches are an SSRF primitive. |
| `ssl.auto_provision` | `false` | Let the platform order and renew certificates through an ACME provider. |
| `ssl.acme_staging` | `true` | Use the staging CA until an operator turns this off. |
| `ssl.acme_directory_url` | staging URL | ACME directory to talk to. |
| `ssl.acme_contact_email` | — | Contact address for expiry notices. |
| `ssl.renewal_days_before_expiry` | `30` | Renewal window, matching the spec. |
| `cron.task.renew_ssl_certificates.enabled` | `true` | Platform-wide switch for the 6-hourly renewal sweep. |

## Cultures

LocalMe ships **two cultures, both first-class**. `fa-IR` is the default:
right-to-left, the Iransans and Vazir typefaces, Shamsi dates, Persian digits.
`en-US` is not an English fallback — it has its own direction, calendar and
numerals like any other. See [ADR 008](./docs/adr/008-multi-culture-rtl-and-shamsi-calendar.md).

Choosing a culture flips the document direction, the typeface, the calendar and
the numeral system, and it is available in **every** panel — the landing page,
`/auth`, the dashboard, a project workspace, `/docs`, `/account` and `/admin` —
because a control that exists on only some pages is a control people cannot find.

**Wording is editable at runtime.** Every user-visible string is a key in
`lib/i18n/messages/*` with a value for each culture. The catalog ships in the
bundle as the floor; the admin console's **Translations** tab writes *overrides*
to the `translations` table, and they survive a deploy. Resolution is
override → shipped → the key itself, so an untranslated key is visibly broken
rather than silently falling back to English.

**Dates are computed, not re-skinned.** `lib/jalali.ts` is a real Shamsi
implementation — leap-year-correct month lengths, a week starting on شنبه, and
typed entry in Persian or Arabic-Indic digits. Every number, byte count, date
and relative time in the UI goes through `lib/i18n/format.ts`, which binds the
arithmetic to a `t()` so the *words* stay editable too: `۳ دقیقه پیش`, `۵ مگابایت`.

Adding a culture is a change to `lib/i18n/locales.ts` plus a catalog, not a
sweep through the UI. `MessageGroup` is used as a `satisfies` target and never
as a declared type, so a renamed key is a build error instead of an English
sentence leaking into the Persian console.

## Repository layout

```
app/            Next.js App Router: pages, layouts and route handlers
  api/          Platform REST API (auth, db, storage, routing, ...)
  docs/         API documentation site
  page.tsx      Marketing landing page with the live in-browser demo
components/     Console and UI components (design system in components/ui)
lib/            Shared client/server code (formatting, theme, SEO)
lib/i18n/       Culture layer: locales, catalog, formatters, Jalali engine
lib/jalali.ts   Shamsi date engine (the only calendar implementation in the app)
lib/server/db/  Dialect-agnostic data layer (Drizzle + DSL compiler; see ADR 003)
db/sqlite/      SQLite migrations (default dialect)
db/postgres/    Postgres migrations (production dialect)
docs/           Product specification, ADRs and the [2026-09-30 audit](./docs/audit-2026-09-30.md)
tests/          Vitest unit tests (run in CI, never as a sandbox gate)
scripts/        Migration runner, demo seeder and the backup tool
```

The suite always runs against its own in-memory SQLite. `tests/setup-env.ts` clears
`DB_PATH`/`DATABASE_URL` before any test module loads, because `.env.local` is present
in every shell — without it `bun run test` opens the developer's own database, and a
cleanup in a test file deletes it. The Postgres leg sets `DB_DRIVER=postgres` itself
and is left alone.

## What a project gets

- `/{username}/{project}/` serving of uploaded static assets with route resolution, a
  `404.html` fallback and a watermark injection (toggleable per project).
- `/api/db/*`, `/api/storage/*` document and file APIs scoped to the caller's project, plus
  `/{username}/library/<asset>` — a CDN namespace for assets shared across the owner's
  projects. `library` is a reserved project and folder name: an asset is uploaded once and
  every project references that one URL, with nothing copied between projects.
- Visitor accounts with project-scoped roles, captcha-gated logins and account lockout after
  repeated failures; API keys hashed at rest. A visitor session is a first-class caller on
  `/api/db/*` and `/api/storage/*` (its cookie is scoped by name, not by path), so a page
  behind `requires_auth` can actually read and write its own data once signed in.
- Encrypted secrets (`{{KEY}}` substitution in proxy routes, which act as path-preserving
  mounts), webhooks with HMAC signatures and a delivery log, and built-in cron jobs backed by
  the database — the five documented jobs plus failed-webhook retry, storage audit, heartbeat and
  certificate renewal, each runnable per project or platform-wide and each accepting its own
  `schedule` or `every_minutes` cadence.
- Custom domains verified by DNS TXT record, with opt-in ACME provisioning over HTTP-01,
  certificate renewal 30 days out, and `/.well-known/acme-challenge/` token serving; per-project
  endpoint policy (enabled + public/anonymous access), usage rollups, and JSON/ZIP import–export
  of every configuration feature plus the whole project (`/api/export/all`, `/api/import/all`).
- Asset delivery with strong ETags, conditional 304s, a bounded in-process cache invalidated on
  write, Brotli/gzip compression, and minification on save. Anti-hotlink validation compares a
  `Referer` against the *forwarded* request host, so a project's own assets are never mistaken
  for a third-party embed behind a reverse proxy or preview tunnel.
- Anonymous-callable JSON endpoints, granular API-key permissions (15 documented grants),
  Referer/Origin hotlink protection and Brotli/gzip response compression for assets.
- A curated platform-wide asset library at `/~public/<path>`, a `/health` probe, and an
  operator console (`/admin`) for platform stats, projects, accounts, global cron switches,
  the public library and system configuration.
- Structured NDJSON logging with credential redaction (`logging.*`), a webhook outbox, and
  `bun run backup` for `pg_dump`/`VACUUM INTO` snapshots with verification, restore and retention.

## HTTP API

The full endpoint reference ships on the docs site at `/docs` (source: `app/docs/page.tsx`).
Authentication is a platform session cookie, a visitor session, `Authorization: Bearer <API key>`,
or `X-API-Key: <API key>`. A route can gate on a visitor role, a single §5.5 permission
(`required_permission`), or both.

## Verification

CI (`.github/workflows/ci.yml`) runs on every PR and on `main`:

```bash
bun run typecheck       # tsc --noEmit
bun run lint            # eslint (flat config, next/core-web-vitals + typescript)
bun run test            # vitest on in-memory SQLite
bun run test:postgres   # vitest on a real Postgres (CI service container)
bun run build           # next build
```

The document-store contract in `tests/db/document-store.contract.ts` runs on **both** dialects,
so SQLite and Postgres cannot drift; `bun run test:postgres` additionally asserts that the
`schema_migrations` ledger lists every file in `db/postgres/`. Locally it needs a reachable
server:

```bash
DB_DRIVER=postgres DATABASE_URL=postgresql://user:pass@localhost:5432/localme bun run db:migrate
DB_DRIVER=postgres DATABASE_URL=postgresql://user:pass@localhost:5432/localme bun run test:postgres
```

## Production deployment

The production host builds `bun run build` and serves the Next.js server. Recommended for
production is the Postgres dialect:

- `DB_DRIVER=postgres`, `DATABASE_URL` (Neon free tier works), `SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL` — the public origin (canonical URLs, hosted-project links, sitemap)
- `ADMIN_INITIAL_PASSWORD` — the first administrator's password (see **First boot**)

SQLite (`DB_DRIVER=sqlite` + `DB_PATH=file:…`) remains valid for single-node self-hosting.

### One-liner

```bash
bun install && bun run typecheck && bun run lint && bun run test && bun run build && bun run start
```

Or as separate steps: `bun install` · `bun run test` · `bun run lint` ·
`bun run typecheck` · `bun run build` · `bun run start` (serves the built app on
`$PORT`, default 3000). Add `bun run db:migrate` before the first `start` when
you use a file-backed SQLite database or Postgres; in-memory SQLite migrates
itself.

| Script | What it does |
| :----- | :----------- |
| `bun run dev` | dev server on `0.0.0.0:$PORT` |
| `bun run test` | 210 tests on in-memory SQLite |
| `bun run test:postgres` | the dialect contract on Postgres (needs `DATABASE_URL`) |
| `bun run lint` | ESLint (flat config) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run build` | production build |
| `bun run start` | serve the production build |
| `bun run db:migrate` | apply `db/*/**.sql` to a file-backed SQLite DB or Postgres |
| `bun run seed` | demo accounts/projects (`-- --reset` to rebuild them) |
| `bun run backup` | snapshot / verify / restore |

## Backups

```bash
bun run backup                       # snapshot + prune past --retention-days (30)
bun run backup -- --list             # what is on disk
bun run backup -- --verify <file>    # sanity-check an archive before trusting it
bun run backup -- --restore <file>   # load a snapshot back
bun run backup -- --dir /mnt/backups --db file:/var/lib/localme/localme.db
```

The script picks the method from the active driver: `pg_dump` for Postgres (the connection
string comes from `DATABASE_URL`, never from argv) and `VACUUM INTO` — with a plain file copy as
fallback — for SQLite. It takes CLI flags rather than reading the environment inline so the same
snapshot works from cron, a systemd timer or a CI job.

---

## Operating notes

- See [`SECURITY.md`](./SECURITY.md) for the threat model and the controls the
  platform enforces, and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the gates a
  change must pass.
- Docs are the contract; product-behavior deviations go through `docs/adr/`.
- The working tree is kept deployable at all times; CI must pass before merge.

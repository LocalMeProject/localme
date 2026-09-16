# LocalMe

LocalMe is a Backend-as-a-Service for frontend-only applications. You write HTML, CSS and
JavaScript, upload it, and the platform provides everything else: a JSON document database, file
and asset storage, visitor accounts with roles and permissions, routing, encrypted secrets, a
reverse proxy, a shared asset library, scheduled tasks, webhooks, custom domains and usage
reporting.

The product specification lives in [`docs/`](./docs). This repository is the running
implementation: a React console (`src/`) on top of a Convex backend (`src/convex/`) that also
serves every hosted project over HTTP.

---

## Stack

| Layer      | Choice                                                                   |
| :--------- | :----------------------------------------------------------------------- |
| Frontend   | Vite, React 19, TypeScript, Tailwind CSS, Radix primitives, zustand      |
| Routing    | react-router-dom (public site, `/auth`, `/docs`, console, admin console)  |
| Backend    | Convex functions (queries, mutations, actions) + `convex/http.ts` router  |
| Database   | Convex document store (schema-validated)                                  |
| Files      | Convex file storage for blobs, inline text for editable files             |
| Passwords  | scrypt-class hashing via `@noble/hashes`, secrets encrypted with AES-256-GCM |
| Tooling    | Bun                                                                       |

No server-side user code is ever executed. A project is static assets plus calls to the documented
platform API.

---

## Getting started

```bash
bun install          # install dependencies
bun convex dev       # push functions and keep codegen running (managed by Freebuff in the sandbox)
bun run dev          # Vite dev server on 0.0.0.0:$PORT
```

`convex dev` writes the deployment URL into `.env.local` as `VITE_CONVEX_URL` (and
`VITE_CONVEX_SITE_URL`). The first account created on a fresh deployment automatically becomes the
platform administrator.

Useful scripts:

| Script              | Purpose                                         |
| :------------------ | :---------------------------------------------- |
| `bun run dev`       | Vite dev server                                 |
| `bun run build`     | `vite build` — static output in `dist/`         |
| `bun run typecheck` | `tsc -b --noEmit`                               |
| `bun run convex:dev`| Push Convex functions with codegen              |
| `bun run seo`       | Bake `SITE_URL` into `index.html`, robots and sitemap |
| `bun run og`        | Regenerate `public/og.png` (social share card)  |

The hosting build command is `bun run build`, so it stays a plain `vite build` and exits — `typecheck`
and `seo` are separate scripts you run yourself.

---

## Repository layout

```
src/convex/            Backend — every function the platform exposes
  schema.ts            All tables and indexes
  http.ts              HTTP router: /api/*, /auth/*, /library/*, /~public/*, project serving
  accounts.ts          Platform accounts, sessions, profile, admin user management
  authz.ts             Visitor principals, captcha, login/signup/logout, permission resolution
  projects.ts          Project lifecycle, scaffolding (roles, routes, endpoints, cron, seed files)
  storage.ts           Project files + shared library
  data.ts              Document database and query DSL execution
  routing.ts           Routes, endpoint toggles, resolution helpers
  access.ts            Roles, visitors, API keys, sessions
  secrets.ts           AES-256-GCM secret store and proxy lookups
  domains.ts           Domain registration and DNS verification
  automation.ts        Cron tasks and webhook delivery
  insights.ts          Usage, activity and admin reporting
  transfer.ts          Feature/archive export and import
  settings.ts          System configuration, health, admin project controls
  maintenance.ts       Rate limiting and cleanup primitives
  crons.ts             Platform-level scheduled jobs
  lib/                 crypto, dsl, paths, permissions, sessions, zip, minify, validation …

src/                   Console (the platform UI)
  pages/               Landing, auth, docs, dashboard, library, admin, project/* tabs
  components/          App shell, project shell, editor, JSON field, UI kit, live demo
  lib/                 Convex client, session store, formatters, upload helpers, SEO, demo apps

public/                Static assets: social share card, web app manifest
scripts/               generate-og.mjs (brand card), generate-seo.mjs (robots + sitemap)
docs/                  Product specification (source of truth)
backend/, frontend/    Original reference notes for the .NET/Next.js stack
```

---

## What a project gets

- **Serving** — `https://<origin>/<username>/<project>/` with route → HTML resolution, directory
  index fallback, custom `404.html`, per-project watermark toggle and cached static assets.
- **Database** — schema-less tables, mandatory unique `id` per document, a MongoDB-style filter
  grammar (`$eq $ne $gt $gte $lt $lte $in $nin $regex $exists $and $or $not`), sort, pagination
  capped at 500 documents per page.
- **Storage** — project files plus a 5 MB shared library, with a hard cap checked before any write
  and a 10 MB per-file ceiling.
- **Visitors** — per-project signup and login with a math CAPTCHA, lockouts, sliding 20-minute
  sessions, four built-in roles and custom roles with 15 granular permissions.
- **API keys** — `X-API-Key` credentials scoped to storage and library operations for agents and
  CI, with prefixes, expiry and revocation.
- **Secrets & proxy** — encrypted values with `{{KEY}}` substitution inside proxy route headers, so
  third-party keys never reach the browser.
- **Cron** — five built-in tasks (session cleanup, log retention, daily stats, daily summary
  webhook, orphaned upload cleanup) with per-project parameters, manual runs and run history.
- **Webhooks** — up to 20 endpoints per project, event selection, HMAC signing and a delivery log.
- **Domains** — TXT-record ownership verification, certificate status tracking and DNS guidance.
- **Backup** — per-feature JSON export/import and a full ZIP archive (`storage/`, `lib/`,
  `config/config.json`, `config/secrets.json`).
- **Usage** — visit counting for HTML serves only, five-minute dedupe, monthly reset and daily
  aggregates.

---

## HTTP API

The console documents the whole surface at `/docs`, and `GET /health` reports deployment status.
Quick reference:

```
POST /api/db/find | insert | update | delete
GET  /api/storage/list | status | download      POST /api/storage/upload | delete
GET  /api/lib/list | status                     POST /api/lib/upload | delete
POST /api/secrets/get
GET  /auth/captcha | login | me | logout        POST /auth/token
GET  /library/<name>                            GET /~public/<name>
```

Requests resolve their project from the request path, an `X-Project-Id` header, or a `projectId`
body field. Callers authenticate with an `X-API-Key` header, a visitor cookie
(`auth_<projectId>`) or an owner session. Failures return `{ "error": "...", "code": "..." }` with
standard status codes (400, 401, 402, 403, 404, 409, 413, 429, 500).

---

## Marketing site, SEO and the live demo

`/` is a full marketing page: an interactive demo, feature pillars, use cases, a comparison table,
pricing and an FAQ. It renders three real single-file LocalMe applications (`src/lib/demo-apps.ts`)
inside a sandboxed iframe. The file in the iframe is the same file the platform hosts — the demo only
swaps the network layer for an in-browser stand-in with the identical request/response shapes, and
streams every call into the request inspector beside it. Choosing “Get this app” stages the demo, and
signing up creates the project and writes that exact file into it.

SEO is handled in three places:

- `index.html` — robots, Open Graph, Twitter card, manifest, fonts and a schema.org graph
  (Organization, WebSite, SoftwareApplication) plus a crawlable `<noscript>` summary.
- `src/lib/seo.ts` — a `useSeo()` hook that updates title, description, canonical, OG/Twitter tags and
  injects per-route JSON-LD (FAQPage on the landing page, TechArticle on `/docs`). Console routes pass
  `noIndex`.
- `public/robots.txt` — shipped as a static file, so crawl rules never depend on a build step.

Once you know the public origin, bake the sitemap and the absolute social tags in one command:

```bash
SITE_URL=https://your-console-host bun run seo
```

Hosting rebuilds `dist/` from scratch, so this writes into the **source tree** instead, where it
survives every deploy:

| File                  | Change                                                        |
| :-------------------- | :------------------------------------------------------------ |
| `index.html`          | `canonical`, `og:url`, `og:image`, `twitter:image` go absolute |
| `public/robots.txt`   | gains a `Sitemap:` directive                                   |
| `public/sitemap.xml`  | written                                                        |

The command is idempotent, so re-running it is safe. Social crawlers do not run JavaScript, which is
exactly why those tags must be absolute in the static HTML. Without `SITE_URL` (or `PUBLIC_SITE_URL` /
`VITE_SITE_URL`) the script does nothing at all rather than emit a domain it invented.

---

## Verification

```bash
bun convex dev --once && bun tsc -b --noEmit   # after touching src/convex
bun tsc -b --noEmit                            # frontend only
```

---

## Production deployment

The console is a static bundle; the backend is the Convex deployment it points at. Both must be
reachable from the public internet in production.

1. **Deploy the backend.** In the Freebuff sandbox the Convex backend runs locally, which is fine
   for development but not reachable from production traffic. Deploy it to a hosted Convex
   deployment and note the resulting URLs:

   ```bash
   bunx convex deploy
   # → https://<deployment>.convex.cloud   (client API URL)
   # → https://<deployment>.convex.site    (HTTP router / hosted projects)
   ```

2. **Set the production build variables.** Vite inlines `VITE_*` variables at build time, so they
   must exist in the hosting environment, not only in `.env.local`:

   ```bash
   freebuff-deploy env set '{"VITE_CONVEX_URL":"https://<deployment>.convex.cloud","VITE_CONVEX_SITE_URL":"https://<deployment>.convex.site"}'
   ```

   `VITE_CONVEX_SITE_URL` may be omitted — it is derived from the client URL when absent.

3. **Check and deploy.**

   ```bash
   freebuff-deploy check     # confirms install/build commands and reports problems
   freebuff-deploy start     # redeploys after the first deploy from the Deploy button
   freebuff-deploy status    # state, framework, build time
   freebuff-deploy logs      # build errors
   ```

   Hosting runs `bun install` then `bun run build` (`tsc -b && vite build`) in a clean checkout and
   serves `dist/`. The build must not start a server — the dev server is a separate command.

4. **Environment variables for the backend.** Convex functions read platform configuration from the
   `systemConfigs` table (editable in the admin console under Configuration), not from process env,
   so no extra secrets are required for a normal deployment.

If the console renders the "backend is not connected" notice, `VITE_CONVEX_URL` was missing from
the build environment — set it and redeploy.

---

## Operating notes

- **First account wins.** The first signup on an empty deployment becomes `admin`; the console then
  exposes the Administration section for user, project, configuration and audit management.
- **Agents and CI.** Create a storage-scoped API key per project and send it as `X-API-Key`.
  Keys cannot read or write the database by design.
- **Rotating credentials.** The Auth tab's *Rotate secrets* action signs every visitor out and
  revokes all API keys for a project; the Storage cap and role assignments are unaffected.
- **Backups.** Databases documents are not part of the ZIP archive; export table contents from the
  Database tab if you need them, and keep a ZIP export before large edits.
- **Domains.** Registering a domain gives you a TXT record to publish at
  `_mvp-verify.<domain>`. Verification runs against a DNS-over-HTTPS resolver; certificate issuance
  is completed by the hosting layer once DNS resolves.

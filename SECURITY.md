# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue. Email the maintainers or use GitHub's "Report a vulnerability" button on
the Security tab of the repository.

Include: what you did, what you expected, what happened, and the request/response
that shows it. Please give a reasonable window to ship a fix before disclosing
publicly. There is no bug bounty; the project is pre-1.0 and unfunded.

## Threat model

LocalMe hosts **untrusted, customer-authored HTML, CSS and JavaScript** on a
shared origin, for tenants who are mutually untrusted, and gives every one of
them a server-side HTTP fetch capability. Those two facts drive almost every
decision below.

What the platform does *not* promise:

- **No sandbox for tenant code.** A hosted project runs in the visitor's
  browser, but it is served from the platform's origin by default. A project
  that could set cookies for the platform would own the console session; the
  isolation between "hosted project" and "console" is the cookie path and the
  same-origin policy, not a separate origin.
- **No denial-of-service protection beyond per-identity rate limits.** There is
  no WAF, no bot scoring, and no global request ceiling.
- **No secret isolation between tenants of one account.** A project's owner can
  read their own secrets by design.

## Controls the platform enforces

| Area | Control |
| :-- | :-- |
| Passwords | Platform accounts use scrypt; visitors use bcrypt at cost 12 (§7.3). |
| Sessions | Opaque id in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie, HMAC-signed with the platform signing secret; 20-minute sliding idle window; stored in the database, never in memory. |
| Secrets at rest | AES-256-GCM, key derived from the platform signing secret via scrypt. |
| Authorization | Every route resolves a principal and checks a granular permission; a route's `required_permission` implies its auth gate. Cross-project isolation is enforced by `project_id` in every query. |
| Rate limiting | Applied centrally in `handler()`, so no endpoint can ship unprotected. Budgets per path family, resolved against the §10 tiers. |
| SSRF | Server-side fetch targets (webhooks) are validated: `http`/`https` only, and loopback, private, link-local, CGNAT, ULA and cloud-metadata addresses are refused — including IPv4-mapped IPv6 spellings. Opt out with `webhooks.allow_private_targets` only if you genuinely need a LAN target. |
| XSS | All responses carry `X-Content-Type-Options: nosniff`. The console sets a CSP with `object-src 'none'` and `frame-ancestors 'self'`. Stored HTML is never served as `text/html` from the API origin. Tenant HTML is escaped only where the platform itself emits markup. |
| Clickjacking | `X-Frame-Options: SAMEORIGIN` plus CSP `frame-ancestors`. |
| Transport | HSTS with `includeSubDomains`, per Tech docs §19. |
| Redirects | `returnUrl` after login must be a single-slash same-origin path; protocol-relative and absolute URLs fall back to `/dashboard`. |
| Input | All bodies validated with zod; all SQL parameterized; table and column identifiers validated against an identifier regex; file paths reject traversal. |
| Uploads | Per-file ceiling checked from `Content-Length` before the body is buffered; account cap enforced inside the project write lock. |
| Hotlinking | Asset and library requests are refused when the `Referer`/`Origin` host is neither the request's own forwarded host, a verified custom domain, nor an allowed bot/crawler (including modern AI agents: Anthropic, ChatGPT, Claude, Perplexity, Cursor, Antigravity) — so a project cannot be used as a free CDN by a third party. The comparison uses `X-Forwarded-Host`/`Host` rather than the app's own origin: behind a reverse proxy or preview tunnel those differ, and using the internal name made the rule refuse the project's *own* stylesheet and scripts. |
| AI Agent Governance | Ephemeral Agent Access Tokens (`aat_...`) require explicit human consent via the browser consent screen (`/auth/consent`). Tokens have a short TTL (4h–48h), are cached locally in `localme-aat.txt`, and cannot be auto-renewed without human confirmation. |
| Identity Immutability | Usernames and phone numbers are strictly immutable on user profiles (`/profile`), ensuring that audit logs, project URL mounts, and authorization records cannot be hijacked by renaming accounts. |
| Secrets in logs | Field names are matched segment-wise against a sensitive list, JWT-shaped values are redacted regardless of key, and long values are truncated. Logs are newline-delimited JSON. |
| Backups | `bun run backup` reads the connection string from the environment, never from argv, so it does not leak into the process list. |

## Deploying safely

- Set `SESSION_SECRET` to a high-entropy value. Rotating it invalidates every
  session **and every stored secret** — back up first.
- It is **optional**: when unset, the platform generates a 32-byte secret on
  first boot and stores it in `system_configs` (`platform.session_secret`). That
  keeps a fresh install usable, but it puts the signing key in the database —
  the same trust boundary as the password hashes in the same table, and far
  better than a fixed default. `GET /health` reports `sessionSecretConfigured`;
  set it explicitly for production. See
  [ADR 006](./docs/adr/006-optional-session-secret-and-first-boot-admin.md).
- The first-boot administrator is created only when the `users` table is empty.
  In production the default password (`admin1234`) is **refused** unless you set
  `ADMIN_INITIAL_PASSWORD` or `ALLOW_DEFAULT_ADMIN_PASSWORD=1`, so a deployment
  cannot silently sit on a published credential. Change it from the admin
  console after the first sign-in.
- Set `NEXT_PUBLIC_SITE_URL`. Without it, custom-domain detection and asset
  hotlink allow-listing fall back to guessing.
- Keep `ssl.auto_provision` off until you have a reachable public domain and an
  ACME contact address. Leave `ssl.acme_staging` on until issuance works, so a
  new deployment cannot burn production CA rate limits.
- Terminate TLS in front of the app. The HSTS header is only meaningful over
  HTTPS.
- Back up on a schedule and **test the restore**. `bun run backup -- --verify`
  checks an archive; `--restore` is the only proof that matters.

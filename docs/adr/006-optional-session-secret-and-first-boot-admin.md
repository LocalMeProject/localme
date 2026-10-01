# ADR 004 — Optional `SESSION_SECRET` and a first-boot administrator

**Status**: Accepted
**Date**: 2026-10-01
**Deciders**: platform engineering
**Relates to**: [ADR 001](./001-nextjs-only-architecture.md), [ADR 002](./002-postgres-neon-db-backed-storage.md), [ADR 003](./003-sqlite-first-switchable-postgres.md)

---

## Context

Two problems, both reported from the same first-run experience.

**1. `SESSION_SECRET` was effectively required, and failing without it was
incoherent.**

Three modules read `process.env.SESSION_SECRET` directly and each behaved
differently when it was absent:

| Module | Behaviour with no secret |
| :----- | :----------------------- |
| `lib/server/sessions.ts` | fell back to `""` — **every cookie verified against a key an attacker also knows** |
| `lib/server/visitor-auth.ts` | threw `internal_error`, "SESSION_SECRET is not configured." |
| `lib/server/secrets-crypto.ts` | threw a bare `Error`, surfacing as `500 Something went wrong.` |

So signing in appeared to work (insecurely), while visitor signup on a project
and saving a project secret both failed — with a message that read like the
user's fault and named an environment variable they had no way to set. There was
also no single place that answered "is this deployment configured?".

**2. A fresh deployment had no way in.**

`/admin` and every `/api/admin/*` route require a signed-in administrator. A new
installation has zero users, so the only route to the console was to open the
database by hand. `publicLibraryProject()` threw `"No admin account exists."` on
the very first library write for the same reason. `/health` — the one endpoint an
operator is guaranteed to hit after deploying — reported `database: ok` and
nothing about the fact that the product was unusable.

## Decision

### 1. One resolver, environment first

A new module `lib/server/session-secret.ts` owns resolution:

1. `SESSION_SECRET` from the environment, used verbatim. Always wins.
2. Otherwise a generated 32-byte secret, persisted once in `system_configs` under
   `platform.session_secret`, created with `INSERT … ON CONFLICT DO NOTHING` and
   then re-read, so concurrent workers converge on one value instead of some
   signing with a secret nobody else knows.

All three call sites now resolve through it, so a misconfigured deployment has one
behaviour instead of three. The key is never a constant and never a well-known
default: two deployments never share one.

`GET /health` reports `sessionSecretConfigured` so an operator can tell which mode
they are in without reading logs.

**Why store the fallback in the database rather than generate per boot.** A
per-boot value invalidates every session on every restart and makes rolling
deployments sign each other out. The database is already the trust boundary for
password hashes, so a secret there does not widen it. The trade-off is explicit
and documented in `env.example` and the startup warning: anyone who can read the
`users` and `system_configs` tables can forge sessions — the same capability as
reading password hashes, and strictly better than an empty HMAC key.

**Why not simply refuse to start.** That is the correct posture for a security
control that cannot degrade safely, but `SESSION_SECRET` is doing double duty as
a *convenience* for local development, and a refusal makes `git clone && bun
install && bun run dev` fail. The cost of a missing secret is now a warning
rather than a crash, and production gets the loud version of that warning.

### 2. Bootstrap one administrator, once

`lib/server/bootstrap.ts` creates a single admin when — and only when — the
`users` table is empty. It runs from `GET /health`, the endpoint every deployment
path already touches.

Guards, in order:

- **Zero users only.** It reads `COUNT(*)` first and never runs again once anyone
  exists. A normal signup permanently disables it.
- **Credentials are configurable.** `ADMIN_INITIAL_USERNAME` (default `admin`)
  and `ADMIN_INITIAL_PASSWORD` (default `admin1234`).
- **Production refuses the default.** With `NODE_ENV=production`, no
  `ADMIN_INITIAL_PASSWORD`, and no `ALLOW_DEFAULT_ADMIN_PASSWORD=1`, it declines
  and prints why. A deployment can therefore never end up sitting on a published
  credential because nobody read the documentation.
- **It is loud.** Every success logs to stderr, naming the account and whether it
  used the default password.

`/health` also reports `bootstrapAdmin` so an automated deploy can detect that a
first boot happened.

## Consequences

**Positive**

- A clean checkout runs with no configuration at all; `git clone && bun install &&
  bun run dev` works.
- The session-forgery hole from the empty HMAC fallback is closed regardless of
  configuration.
- A fresh production deployment is reachable by signing in, not by editing a
  database.
- The operator's tier is reported by the API (`overview.viewer`), so the console
  can hide controls rather than offering buttons that 403.

**Negative / accepted**

- A self-hosted operator who never sets `SESSION_SECRET` has their signing key in
  the database. Documented, warned about at boot, and reported by `/health`.
- Rotating `SESSION_SECRET` still invalidates every session and every stored
  secret, because the AES key is derived from it. Unchanged; now documented in
  `env.example`.
- Two extra environment variables that only matter on the first boot of a fresh
  deployment.

**Neutral**

- `sign`, `pack`/`unpack`, `signVisitorToken`, `verifyVisitorToken`, `encryptSecret`
  and `decryptSecret` became async. Every caller already was. This is the cost of
  a resolver that may touch the database.

## Alternatives considered

**Keep `SESSION_SECRET` mandatory and document it harder.** Rejected: it does not
address the deeper problem, which is that three call sites failed three different
ways. Mandatory-and-unclear produces exactly the support question we got.

**Generate an ephemeral secret per process, no persistence.** Rejected: sessions
would not survive a restart, and every rolling deploy would sign everyone out.

**Fail startup in production when `SESSION_SECRET` is missing.** Rejected as the
*only* behaviour for the same reason; kept as the behaviour of the *default
password* guard, where the cost of proceeding is genuinely unacceptable.
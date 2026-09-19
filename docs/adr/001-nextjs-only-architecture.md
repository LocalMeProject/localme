# ADR 001: Single Next.js Application (Backend in API Routes, not .NET 10)

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** Project owner (via directive: "Migrate fully to a single NextJS project")

## Context

The Blueprint (v1.0.0) specifies a two-process architecture: Next.js 16.2 frontend + ASP.NET Core 10 backend on a single Ubuntu server, with PostgreSQL 18.4, Dapper, Quartz.NET, YARP, and Certes.

Two hard deployment constraints conflict with this:

1. **The deployment target builds Node.js projects only.** Freebuff hosting supports Vite+React, Next.js, and CRA. A .NET process cannot be deployed or supervised there.
2. **The owner has directed a single Next.js project**, with all quality gates (typecheck, build, tests) running in GitHub Actions.

## Decision

Implement LocalMe as **one Next.js (App Router) application**:

- **Backend** = Next.js Route Handlers (Node.js runtime) in `app/api/**`, speaking to PostgreSQL via `pg` with raw parameterized SQL (the Dapper philosophy: no heavy ORM abstraction).
- **Frontend** = React client components + server components as appropriate, Tailwind + shadcn/ui conventions preserved from the current design system.
- **Single-server semantics preserved:** Postgres is the only stateful dependency; sessions, rate limits, and all state live in the database (matching the Blueprint's "database-backed persistence" requirement). Scheduled jobs run via a database-backed scheduler (see ADR 002).
- **Reverse proxy** = native `fetch` streaming in a catch-all route handler instead of YARP (same behavior: header injection, secret substitution, streaming bodies).
- **HTML serving + watermark** = streaming response with injection in the project-serving route, matching the watermark middleware spec.

## Consequences

**Positive:**
- Deploys to the target hosting platform with zero process orchestration.
- One language, one type system shared across API and UI; types can be imported by both sides.
- Simpler operational story: one process, one database.

**Negative / deviations from spec:**
- No .NET 10 / Dapper / Npgsql / Quartz.NET / YARP / Certes / Serilog — replaced by Node equivalents (documented per-feature in the tracking issue).
- Vertical threading model differs (Node event loop vs. native async); sustained-throughput characteristics differ but the single-server deployment model is unchanged.
- SSL automation (Let's Encrypt via Certes) is out of scope for app-level implementation: TLS terminates at the platform edge. Domain verification + routing still work; certificate issuance is the host's responsibility. Recorded in the tracking issue.

**Neutrality:** All product-level behavior (APIs, DSL, quotas, watermark, permissions) is specified to match the Blueprint/Technical Documentation so the docs remain the contract. Doc mismatches found during implementation are fixed in the docs, not silently in code.

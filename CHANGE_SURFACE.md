---
title: "Change Surface: Unified Full-Stack ASP.NET Core 10 Server and Apple Frontend"
author: "Antigravity Engineering System"
created_date: "2026-10-15"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "apps/server"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "libs/contracts"
  - "libs/client-sdk"
---

# Change Surface: Unified Full-Stack ASP.NET Core 10 Server and Apple Frontend

## 1. Intent & Business Rationale
Implement the complete full-stack LocalMe platform inside the single ASP.NET Core 10 host (`LocalMe.Server`). Unify the backend data plane (Dynamic SQL REST, Identity & OTP, Shaparak IPG payment ledger, blob storage, Jint compute) with an ultra-premium, Apple-designed developer portal hosted directly from ASP.NET Core `wwwroot`. Execute a 5-pass enterprise audit to ensure production readiness.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Core) | ASP.NET Core 10 single-project host serving both BaaS APIs and embedded Apple frontend |
| `libs/core-domain` | Profile A (Pure Domain) | DAG matrix expansion, Auth/OTP entities, Double-entry IRR wallet domain rules |
| `libs/data-plane` | Profile A (Ports & Adapters) | Full BaaS handlers: Dynamic SQL, OTP dispatch, IPG bridge, Jint script host |
| `libs/infrastructure` | Profile A (Infrastructure) | PostgreSQL migrations, Lua scripts, and in-memory fallback stores |
| `libs/contracts` | Profile D (Contracts) | OpenAPI 3.1 contracts updated for all BaaS routes |
| `libs/client-sdk` | Profile D (Shared SDK) | Client methods for auth, data, payments, and storage |

## 3. Code Surface (Targeted Symbols & Files)
### Added Files
- `libs/data-plane/src/Billing/PricingCatalog.cs`: Superadmin-configurable unit cost catalog (IRR) for all BaaS services.
- `libs/data-plane/src/Billing/UsageMeteringService.cs`: Real-time usage event collector, cost calculator, and wallet balance reconciler.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.cs`: Multi-tenant project manager, per-service API key manager, and schema isolation.
- `libs/data-plane/src/Admin/SuperadminService.cs`: Superadmin and Operator panel backend for dynamic pricing updates, ticket management, and system stats.
- `apps/server/src/wwwroot/shamsi.js`: Jalali / Shamsi date converter, Persian numeral formatter, and interactive Shamsi Datepicker component.
- `apps/server/src/wwwroot/auth.html`: Dedicated authentication portal with fast role switcher (Admin, Operator, Developer).
- `apps/server/src/wwwroot/panel.html`: Developer console with 0-project empty state, CRUD, per-service keys, and PostgREST explorer.
- `apps/server/src/wwwroot/admin.html`: SuperAdmin & Operator portal for user management, system metrics, and support tickets.
- `apps/server/src/wwwroot/admin.js`: SuperAdmin & Operator client controller with RBAC permissions.
- `tests/LocalMe.Integration.Tests/MultiTenantBaasTests.cs`: Full integration tests for project provisioning, usage metering, and superadmin pricing adjustments.

### Modified Files
- `apps/server/src/wwwroot/index.html`: Clean, minimal, professional Landing page with features, pricing, and about sections.
- `apps/server/src/wwwroot/styles.css`: Emerald Green (#10b981) light-mode styling, zero emojis/icons, pure Vazirmatn typography, full RTL.
- `apps/server/src/wwwroot/app.js`: Developer console controller with 0-project flow, CRUD, per-service API keys, and Shamsi datepicker.
- `apps/server/src/Program.cs`: Modular routing (`/`, `/auth/*`, `/panel/*`, `/admin/*`), per-service keys, and RBAC governance APIs.
- `apps/server/src/LocalMe.Server.csproj`: Configure `wwwroot` static file publishing.
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Additional DAG matrix invariant tests.
- `tests/LocalMe.Integration.Tests/StorageAdapterTests.cs`: Expanded storage and auth integration tests.

## 4. Test Surface
### Unit & Domain Tests
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Exhaustive capability toggles and transitive closure checks.
- `tests/LocalMe.Core.Tests/RialAmountTests.cs`: IRR ledger arithmetic, non-negative bounds, and Toman conversions.

### Integration Tests (Real Ephemeral Containers)
- `tests/LocalMe.Integration.Tests/StorageAdapterTests.cs`: LocalDisk and memory blob adapters.
- `tests/LocalMe.Integration.Tests/OtpAuthTests.cs`: OTP generation, expiry, and rate limiting tests.

### Failure & Resilience Tests
- Jint script execution timeout (5s) and memory ceiling (16MB) validation.
- Invalid HMAC OTP verification rejection and attempt lockout.

### Concurrency Tests
- Concurrent double-entry ledger balance updates with idempotency key enforcement.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports.
- [x] Tier 1: Real container integration tests (no engine-substitution emulators like SQLite for Postgres).
- [x] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [x] Tier 1: Directory nesting depth does not exceed 6 levels from project root.
- [x] Tier 1: Database migrations follow Expand/Contract pattern for zero-downtime rollout.
- [x] Tier 2: Files respect size ceilings ($\le 800$ lines hard, $\le 400$ lines soft); no micro-file sprawl.
- [x] Tier 2: Domain test coverage maintains $\ge 95\%$ line & branch coverage; adapters $\ge 80\%$.
- [x] Tier 2: Transactional outbox pattern used for domain events published to brokers.
- [x] Tier 2: Backward compatibility of existing API contracts preserved.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| SPA routing colliding with API routes | Low | High | Strict prefix isolation: APIs under `/_baas/v1/*`, SPA fallback only for unmatched non-API routes |
| Memory leak in Jint script sandbox | Low | High | Strict memory governor constraint (`LimitMemory(16_000_000)`) and CancellationToken timeout |

### Rollback Strategy
Git revert commit to restore previous scaffolded commit `5fd9c1a`.

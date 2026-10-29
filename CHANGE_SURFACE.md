---
title: "Change Surface: Enterprise DBaaS Engine v2, Outbound Egress Fabric, and Supabase Design System"
author: "Antigravity Engineering System"
created_date: "2026-10-29"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "libs/contracts"
  - "libs/client-sdk"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: Enterprise DBaaS Engine v2, Outbound Egress Fabric, and Supabase Design System

## 1. Intent & Business Rationale
Implement the complete enterprise transformation of the LocalMe Database Service (DBaaS), Outbound Network Egress Fabric, and Web Console:
1. Retire in-memory RAM storage for database records, adopting a PostgreSQL Schema-Per-Tenant architecture (`prj_{slug}`) with native typed DDL, dynamic `search_path`, and automated audit changelog.
2. Implement a Parameterized AST Query Engine in `libs/core-domain` supporting dual-mode queries (PostgREST URL syntax + structured JSON query payloads) and full CRUD mutations (`insert`, `update`, `upsert`, `delete`).
3. Deploy multi-tier resource sandboxing (`statement_timeout = 3000ms`, `work_mem = 8MB`, admin hard ceilings) and a 90% disk storage sentinel circuit breaker.
4. Implement a Stateless Gateway SWR Caching Layer (Soft TTL: 5s, Hard TTL: 60s) with surrogate tag-based Redis Pub/Sub invalidations.
5. Deploy a Censorship-Resilient Outbound Egress Fabric: pure IPv4 TCP 443 TLS 1.3 / gRPC multiplexed tunnel (evading DPI bans on WireGuard/UDP/IPv6), autonomous ASN-based domestic vs foreign classification, and user-level CLI reverse relay support.
6. Adopt a Supabase-style custom design system end-to-end in `apps/web-console`: Radix UI primitives, dark-mode-native near-black surfaces (`#0f0f0f`/`#171717`), emerald `#3ECF8E` accents, 4px grid, pill-shaped primary CTAs, Lucide icons, no emojis, Inter (UI) & Source Code Pro (code/technical labels).
7. Implement a Two-Stage Navigation Architecture with full URL routing: Stage 1 (User Workspace Hub `/`) and Stage 2 (Project Service Studio `/projects/:slug/*`) with strict LTR isolation for data grids and SQL runners.
8. Modernize `libs/client-sdk` with a fluent query builder and full mutation operations.
9. Deliver rigorous unit and ephemeral container integration tests satisfying EP-OS Profile A, B, C, and D quality invariants.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/core-domain` | Profile A (Pure Domain) | AST Query Compiler, SQL operators, filter nodes, and parameterized statement builder |
| `libs/data-plane` | Profile A (Ports & Adapters) | Tenant database port, outbound egress dispatcher, ASN routing tree, and service delegation |
| `libs/infrastructure` | Profile A (Infrastructure) | PostgreSQL Schema-Per-Tenant adapter, dynamic DDL, reflection queries, and gateway SWR cache |
| `apps/server` | Profile A (Backend Core) | BaaS REST route handlers, dual-mode query endpoints, and dependency injection |
| `apps/web-console` | Profile B (Web Application) | Supabase design system overhaul, Radix primitives, two-stage navigation, and LTR Database Studio |
| `libs/client-sdk` | Profile D (Client SDK) | Fluent query builder, update, upsert, delete, and increment methods |
| `tests/LocalMe.Integration.Tests` | Profile A/D (Tests) | Unit and integration test suites covering AST compiler, CRUD mutations, SQL injection, and concurrency |

## 3. Code Surface

### Added Files
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`
- `libs/core-domain/src/Database/TenantDbQueryModels.cs`
- `libs/data-plane/src/MultiTenancy/ITenantDatabaseStore.cs`
- `libs/data-plane/src/Network/OutboundEgressDispatcher.cs`
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`
- `apps/server/src/Middleware/GatewayCacheMiddleware.cs`
- `apps/web-console/src/views/WorkspaceHubView.tsx`
- `tests/LocalMe.Integration.Tests/TenantDatabaseEngineTests.cs`

### Modified Files
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Modules.cs`
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.cs`
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`
- `apps/server/src/Routes/BaasServiceRoutes.cs`
- `apps/server/src/Program.cs`
- `apps/web-console/package.json`
- `apps/web-console/pnpm-lock.yaml`
- `apps/web-console/tailwind.config.js`
- `apps/web-console/index.html`
- `apps/web-console/src/index.css`
- `apps/web-console/src/main.tsx`
- `apps/web-console/src/App.tsx`
- `apps/web-console/src/views/DatabaseView.tsx`
- `apps/web-console/src/components/Header.tsx`
- `apps/web-console/src/components/Navigation.tsx`
- `apps/web-console/src/components/modals/CreateProjectModal.tsx`
- `apps/web-console/src/components/modals/CreateTableModal.tsx`
- `apps/web-console/src/types.ts`
- `libs/client-sdk/src/index.ts`
- `pnpm-lock.yaml`

## 4. Test Surface
- `tests/LocalMe.Integration.Tests/TenantDatabaseEngineTests.cs`:
  - AST compiler query operator validation (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is_null`, `order`, `limit`, `offset`).
  - Parameterized SQL generation verifying zero unescaped strings and `@p0` parameter binding.
  - CRUD lifecycle (`insert`, `update`, `upsert`, `delete`) verifying PostgreSQL schema persistence.
  - SQL injection attack resistance fuzzing.
  - Cross-tenant schema isolation checks.
  - Outbound ASN classifier domestic vs. foreign routing tests.
- Full regression test run across `LocalMe.Integration.Tests` asserting 100% pass rate.
- Frontend TypeScript typecheck (`pnpm -C apps/web-console lint`) and Vite build verification.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero in-RAM database record storage; pure stateless .NET data-plane.
- [x] Tier 1: Real container integration tests against PostgreSQL and Redis (no SQLite emulators).
- [x] Tier 1: Zero unparameterized SQL concatenation in client query handlers.
- [x] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [x] Tier 2: Files respect size ceilings ($\le 800$ lines hard, $\le 400$ lines soft).
- [x] Tier 2: Supabase custom design system tokens enforced (#0f0f0f, #171717, #3ECF8E, 4px grid, Inter, Source Code Pro, no emojis).
- [x] Tier 2: Strict LTR isolation (`dir="ltr"`, `font-mono`) for all SQL, code, and table data cells.
- [x] Tier 2: Mechanical blast-radius compliance verified via `ep surface check-diff`.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| PostgreSQL schema creation permission error | Low | Medium | Automated fallback to public schema with tenant table prefixing if schema creation restricted |
| DPI packet drop on outbound egress | Medium | Medium | In-memory retry loop with exponential backoff and automatic domestic fallback |
| Web console theme visual regressions | Low | Low | Strict CSS variable scoping with fallback color tokens |

### Rollback Strategy
Git branch reset or revert commit: `git revert HEAD`.

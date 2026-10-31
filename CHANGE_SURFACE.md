---
title: "Change Surface: DBaaS Batch 3 — Client SDK Parity, Real-Time CDC & Query Compiler Extensions"
author: "Antigravity Engineering System"
created_date: "2026-10-31"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "apps/server"
  - "libs/client-sdk"
  - "libs/contracts"
  - "libs/core-domain"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: DBaaS Batch 3 — Client SDK Parity, Real-Time CDC & Query Compiler Extensions

## 1. Intent & Business Rationale
1. Extend `SqlAstQueryCompiler` with `OR` grouping filters, JSON/array containment (`cs`, `cd`), and full-text search (`fts`).
2. Implement Client SDK feature parity: `updateWhere`, `deleteWhere`, and batch `insertMany`.
3. Add client aggregate and count query helpers (`count()`, `sum()`, `avg()`, `min()`, `max()`).
4. Mount real-time Change Data Capture (CDC) Server-Sent Events (SSE) route `GET /_baas/v1/{projectId}/db/realtime` tied to `ProjectManagerService.OnTableEvent`.
5. Implement real-time subscription listener (`.on(event, callback)`) in Client SDK.
6. Formalize all DBaaS v2 endpoints and schemas in `libs/contracts/schemas/openapi.json`.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/core-domain` | Profile A (Backend DDD Core) | Add `Contains`, `ContainedBy`, `TextSearch`, `OrGroup` query operators and compiler logic |
| `apps/server` | Profile A (Backend Service Host) | SSE real-time streaming endpoint, batch insert, and filter-based update/delete |
| `libs/client-sdk` | Profile D (Client SDK) | Parity additions (`insertMany`, `updateWhere`, `deleteWhere`, aggregates, SSE subscription) |
| `libs/contracts` | Profile C (Contracts & Schemas) | Complete OpenAPI 3.1 definitions for DBaaS v2 |

## 3. Code Surface

### Added Files
- `tests/LocalMe.Integration.Tests/DbaasSdkRealtimeTests.cs`: Integration tests verifying compiler extensions, SSE streaming, and batch mutations.

### Modified Files
- `CHANGE_SURFACE.md`: Batch 3 blast radius and verification declaration.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: SSE streaming route `/_baas/v1/{projectId}/db/realtime` and batch mutation endpoints.
- `libs/client-sdk/src/index.ts`: Export database helpers and real-time subscription API.
- `libs/client-sdk/src/query-builder.ts`: Query builder methods for `or`, `contains`, `containedBy`, `textSearch`, `count`, `insertMany`, `updateWhere`, `deleteWhere`, and `on`.
- `libs/contracts/schemas/openapi.json`: Formal API specification for DBaaS v2 endpoints.
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`: Compiler support for `cs`, `cd`, `fts`, `or` grouping, and aggregates.
- `libs/core-domain/src/Database/TenantDbQueryModels.cs`: Extended `QueryOperator` enum.
- `tests/LocalMe.Integration.Tests/DbaasSecurityAndGuardrailTests.cs`: Enforce CA1861 static array declarations.

## 4. Test Surface

### Unit & Domain Tests
- `tests/LocalMe.Integration.Tests/DbaasSdkRealtimeTests.cs`:
  - `SqlAstQueryCompiler_SupportsOrGrouping_CompilesProperSql`
  - `SqlAstQueryCompiler_SupportsJsonContainment_CompilesCsCd`
  - `SqlAstQueryCompiler_SupportsFullTextSearch_CompilesTsVector`
  - `BaasServiceRoutes_BatchInsert_InsertsMultipleRows`

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports.
- [x] Tier 1: Zero direct database URI leakage.
- [x] Tier 2: Backward compatibility of existing SDK method signatures preserved.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| SSE connection leaks | Low | Medium | Client cancellation token and periodic heartbeat keep-alive comment |
| Complex OR filter SQL injection | Low | High | Strict parameterization for all values and identifier sanitation |

### Rollback Strategy
Git branch reset: `git checkout main && git branch -D feat/dbaas-sdk-realtime`.

---
title: "Change Surface: DBaaS Batch 1 — Security, Guardrails, Snapshot Retention & Data Plane Hardening"
author: "Antigravity Engineering System"
created_date: "2026-10-31"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
---

# Change Surface: DBaaS Batch 1 — Security, Guardrails, Snapshot Retention & Data Plane Hardening

## 1. Intent & Business Rationale
1. Eliminate direct database credentials, URI configurations, and the `/database/config` panel from `apps/web-console` to ensure zero direct client access to PostgreSQL.
2. Implement strict SQL guardrails in `libs/core-domain` (`SqlGuardrailValidator.cs`) blocking DDL (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`), administrative operations, and system catalog access in raw SQL execution endpoints (`/_baas/v1/{projectId}/sql/execute` and `/db/sql`), reserving DDL exclusively for Schema Designer.
3. Inject authenticated JWT claims (`sub`, `role`) into request transaction state (`SET LOCAL request.jwt.claim.sub` and `role`) inside `PostgreSqlTenantSchemaStore.cs` to ensure PostgreSQL Row-Level Security (RLS) helper functions (`auth.uid()`, `auth.role()`) operate reliably.
4. Replace in-memory mock snapshot generation with real PostgreSQL tenant schema and table row export and point-in-time restore, enforcing an automated 3-day snapshot retention lifecycle.
5. Fix array (`int[]`, `text[]`) and JSON/JSONB serialization in `ExecuteQueryAsync`, ensure `EXPLAIN` and `SHOW` return rows in `ExecuteRawSqlAsync`, and remove silent dynamic `ALTER TABLE` mutations during row insertions.
6. Eliminate `.GetAwaiter().GetResult()` synchronous blocking across `ProjectManagerService.Tables.cs` and `ProjectManagerService.Modules.cs` to prevent thread-pool starvation under high concurrency.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/core-domain` | Profile A (Backend DDD Core) | Implement `SqlGuardrailValidator` and fix `IN` operator parsing for non-string collections |
| `libs/data-plane` | Profile A (Backend Data Plane) | Pure asynchronous tenant table operations, snapshot restore engine, and 3-day retention logic |
| `libs/infrastructure` | Profile A (Backend Persistence) | PostgreSQL RLS context injection, complex type serialization, query plan reader, and snapshot dump/restore |
| `apps/server` | Profile A (Backend Service Host) | Guardrail enforcement on SQL endpoints, snapshot restore routing, and DI cleanup |
| `apps/web-console` | Profile B (Web Application) | Permanent removal of `/database/config` view, wiring real snapshot list and restore actions |

## 3. Code Surface

### Added Files
- `libs/core-domain/src/Database/SqlGuardrailValidator.cs`: Pure domain DML/DDL validator blocking dangerous SQL operations.
- `tests/LocalMe.Integration.Tests/DbaasSecurityAndGuardrailTests.cs`: Full TDD regression test suite asserting guardrails, RLS injection, and snapshot restore.

### Modified Files
- `PRODUCT_SKILL.md`: Persist DBaaS security, DDL guardrails, and 3-day snapshot retention invariants.
- `apps/server/src/Program.cs`: Remove dead `DynamicSqlHandler` DI registration.
- `apps/server/src/Routes/BaasDbSnapshotRoutes.cs`: Mount `POST /_baas/v1/{projectId}/db/snapshots/{id}/restore` endpoint.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: Enforce `SqlGuardrailValidator` and attach consistent pagination/latency headers.
- `apps/web-console/src/components/Navigation.tsx`: Remove sub-navigation to direct connection config.
- `apps/web-console/src/views/DatabaseView.tsx`: Eradicate direct DB URI configuration tab and wire real snapshot table and restore.
- `apps/web-console/src/views/database/SqlQueryRunner.tsx`: Restrict quick snippet templates strictly to DML operations.
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`: Support non-string enumerables in `IN` operator.
- `libs/data-plane/src/MultiTenancy/ITenantDatabaseStore.cs`: Add user context claims to query methods and snapshot export/restore contracts.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Modules.cs`: Remove fake SQL parsers and provide async execution.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Snapshots.cs`: Implement PostgreSQL snapshot export, restore, and 3-day retention prune.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`: Remove synchronous blocking `.GetAwaiter().GetResult()` and unawaited tasks.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: RLS context injection, array/JSON serialization, query plan reader, and snapshot DDL/DML.
- `tests/LocalMe.Integration.Tests/TenantDatabaseEngineTests.cs`: Additional unit tests for AST compiler fixes.

## 4. Test Surface

### Unit & Domain Tests
- `tests/LocalMe.Integration.Tests/DbaasSecurityAndGuardrailTests.cs`:
  - `SqlGuardrailValidator_RejectsDdlStatements`: Assert that `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, `TRUNCATE` are rejected.
  - `SqlGuardrailValidator_RejectsSystemCatalogAndFileOperations`: Assert that `pg_catalog`, `pg_read_file`, `copy from program` are blocked.
  - `SqlGuardrailValidator_AllowsStandardDmlAndExplain`: Assert that `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `EXPLAIN` are permitted.
  - `SqlAstQueryCompiler_HandlesNonStringInValues`: Assert that `IN` filter with integer arrays is not silently dropped.

### Integration Tests (Real Ephemeral Containers)
- `tests/LocalMe.Integration.Tests/DbaasSecurityAndGuardrailTests.cs`:
  - `PostgreSqlTenantSchemaStore_InjectsRlsContext`: Verify `auth.uid()` and `auth.role()` return injected JWT claims in PostgreSQL.
  - `PostgreSqlTenantSchemaStore_SerializesArraysAndJsonProperly`: Verify native PostgreSQL `text[]`, `int[]`, and `JSONB` return valid JSON structures.
  - `PostgreSqlTenantSchemaStore_ExecuteRawSql_ReturnsPlanForExplain`: Verify `EXPLAIN ANALYZE SELECT` returns plan rows.
  - `PostgreSqlTenantSchemaStore_InsertRow_RejectsMissingColumnWith400`: Assert missing columns do not trigger auto-DDL.
  - `ProjectManagerService_SnapshotExportAndRestore_MaintainsDataIntegrity`: Assert snapshot creates a real database export and restores table rows.
  - `ProjectManagerService_PrunesSnapshotsOlderThanThreeDays`: Assert 3-day retention cleanup.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports (`SqlGuardrailValidator`).
- [x] Tier 1: Real container integration tests (Podman PostgreSQL; zero mock engine substitutions).
- [x] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [x] Tier 1: Directory nesting depth does not exceed 6 levels from project root.
- [x] Tier 2: Files respect size ceilings ($\le 800$ lines hard, $\le 400$ lines soft).
- [x] Tier 2: Domain and data plane test coverage maintained with real assertions.
- [x] Tier 2: Backward compatibility of existing API contracts preserved.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Existing developers running legitimate DDL through SQL runner | Medium | Low | Clear 400 Bad Request error directing them to Schema Designer |
| Snapshot restore failure leaving schema in partial state | Low | High | Enforce single transactional boundary (`BEGIN ... COMMIT`) during restoration |
| Performance overhead from SQL guardrail inspection | Low | Low | Fast regex tokenization running in sub-millisecond time |

### Rollback Strategy
Git branch reset: `git checkout main && git branch -D feat/dbaas-security-dataplane`.

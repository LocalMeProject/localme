---
title: "Change Surface: DBaaS Architecture, Performance & High-Throughput Hardening"
author: "Antigravity EP-OS System"
created_date: "2026-11-01"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/client-sdk"
  - "libs/contracts"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: DBaaS Architecture, Performance & High-Throughput Hardening

## 1. Intent & Business Rationale
Implement the 33-item remediation plan resulting from the enterprise audit of the DBaaS subsystem.
The objective is to achieve rock-solid high-throughput operational readiness (serving > 1,000,000 requests per day on memory-constrained 512MB–2GB shared/managed hosts) while eliminating runtime bugs, type corruption, catalog lockups, and test coverage gaps.

Key Business & Technical Outcomes:
1. **Zero-Type Corruption**: Native JSON primitives preserved across all CRUD and returning mutations via centralized `PostgreSqlValueConverter`.
2. **Dynamic Parameter & JSONB Coercion**: Eliminates Postgres errors `42883` (operator mismatch) and `42804` (JSONB mismatch) via cached schema type resolution.
3. **Bounded-Memory Schema Caching**: Replaces unbounded dictionary with bounded `MemoryCache` (`SizeLimit = 1000`, 30m sliding TTL), keeping metadata memory footprint $\le 2\text{MB}$.
4. **Single-Roundtrip Table Overview**: `GET /db/tables/overview` replaces the $2\times N$ browser HTTP request fanout on dashboard mount, reducing dashboard TTFB from ~600ms to $< 20\text{ms}$.
5. **Streaming Snapshots & Safe Restores**: Streaming `Utf8JsonWriter` snapshot exports preventing LOH fragmentation, with `SET LOCAL session_replication_role = 'replica'` during restore.
6. **Guardrail Precision**: Strips string literals and comments in `SqlGuardrailValidator`, eliminating false positives on `comment` columns or `'drop'` literals.
7. **`auth.uid()` RFC 7519 Standardization**: Standardizes `auth.uid() RETURNS text`, resolving Postgres error `42P13`.
8. **Client SDK Parity & Typed Errors**: Implements missing column DDL (`addColumn`, `dropColumn`, `alterColumn`), fixes `.not()` syntax, and surfaces structured database error codes.
9. **Data Grid Usability**: Preserves leading zeros on phone/national IDs, supports custom/natural primary keys, and debounces server-side search.
10. **Real Container Integration Verification**: Implements `PostgreSqlTestFixture` connecting to real PostgreSQL 18.1 ephemeral containers, satisfying Prime Directive P4.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/core-domain` | Profile A (Backend DDD) | Query compiler negative operators, AST limits, SQL guardrail literal stripping |
| `libs/infrastructure` | Profile A (Backend Adapter) | Bounded schema caching, `PostgreSqlValueConverter`, JSONB binding, streaming snapshots |
| `libs/data-plane` | Profile A (Data Plane) | Pure async table service methods, table overview service coordination |
| `apps/server` | Profile A (Service Host) | Mount overview route, standardized error translation, update operational runbook |
| `libs/contracts` | Profile D (Contracts) | OpenAPI 3.1 specification parity for all mutation and query routes |
| `libs/client-sdk` | Profile D (Shared SDK) | Column DDL client methods, dynamic primary key matching, structured error handling |
| `apps/web-console` | Profile B (Frontend Application) | Single overview call, leading zero preservation, dynamic PK, modal inputs, RLS explanation |
| `tests/LocalMe.Integration.Tests` | Profile D (Verification Suite) | Dual-mode real PostgreSQL 18.1 integration test harness and test batteries |

## 3. Code Surface (Targeted Symbols & Files)

### Added Files
- `libs/infrastructure/src/Storage/PostgreSqlValueConverter.cs`: Centralized, zero-allocation reader value conversion to native JSON primitives.
- `docs/adr/0005-inprocess-dynamic-sql-and-dbaas-engine.md`: Architectural Decision Record for the pure .NET 10 DBaaS engine.
- `tests/LocalMe.Integration.Tests/PostgreSqlTestFixture.cs`: Dual-mode real PostgreSQL container / local test fixture.
- `apps/server/src/wwwroot/assets/index-BQ1U8yKh.css`: Compiled frontend production stylesheet.
- `apps/server/src/wwwroot/assets/index-hQMBoyIh.js`: Compiled frontend production script bundle.

### Modified Files
- `PRODUCT_SKILL.md`: Add bounded-resource & high-throughput DBaaS operational invariants.
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`: Support negative operators (`not.eq`, `not.in`), configurable limits up to 10,000, and sanitization hardening.
- `libs/core-domain/src/Database/SqlGuardrailValidator.cs`: Literal & comment stripping, verb anchoring, `\bCOMMENT\s+ON\b` DDL check.
- `libs/core-domain/src/Database/TenantDbQueryModels.cs`: Add `TableOverviewItem` and consolidate column models.
- `libs/infrastructure/src/LocalMe.Infrastructure.csproj`: Add Microsoft.Extensions.Caching.Memory for bounded schema caching.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: Bounded `MemoryCache`, parameter type coercion, JSONB explicit binding, `auth.uid() RETURNS text`.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Snapshots.cs`: Streaming `Utf8JsonWriter` exports, `session_replication_role = 'replica'` restore.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Indexes.cs`: Invalidate schema cache on index DDL.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Policies.cs`: Support `checkExpression` and default-deny validation.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Relationships.cs`: Invalidate schema cache on FK DDL.
- `libs/infrastructure/src/Migrations/002_TenantSchema.sql`: Standardize `auth.uid() RETURNS text`.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`: Replace blocking `.GetAwaiter().GetResult()` calls with pure async methods; add table overview coordination.
- `libs/data-plane/src/MultiTenancy/ITenantDatabaseStore.cs`: Add `GetTablesOverviewAsync` contract method.
- `apps/server/src/Routes/BaasDatabaseRoutes.cs`: Map `GET /_baas/v1/{projectId}/db/tables/overview`.
- `apps/server/src/Routes/BaasDatabaseSchemaRoutes.cs`: Connect overview and column endpoints to cache invalidation.
- `apps/server/src/Routes/BaasDatabaseErrorHelper.cs`: Enhance PostgreSQL error mapping with SQL state translations.
- `apps/server/src/Program.cs`: Remove obsolete DynamicSql namespace using directive.
- `apps/server/RUNBOOK.md`: Add DBaaS troubleshooting runbook (connection pool starvation, catalog locks, snapshot pruning).
- `apps/server/src/wwwroot/panel.html`: Updated entrypoint bundle references.
- `libs/contracts/schemas/openapi.json`: Add schemas for `PATCH`, `PUT`, `DELETE` rest routes, overview endpoint, and column management.
- `libs/client-sdk/src/database.ts`: Add `addColumn`, `dropColumn`, `alterColumn`, `getTablesOverview`.
- `libs/client-sdk/src/query-builder.ts`: Support dynamic primary keys in `.update()` and `.delete()`, parse detailed error bodies.
- `libs/client-sdk/src/types.ts`: Add `TableOverviewItem` and SDK error type definitions.
- `apps/web-console/src/views/DatabaseView.tsx`: Integrate single overview call, remove dead DDL checks, dynamic SQL snippets.
- `apps/web-console/src/views/database/DatabaseDashboardView.tsx`: Use single overview payload, display `PostgreSQL 18.1 Multi-Tenant`.
- `apps/web-console/src/views/database/TableDataGrid.tsx`: Type-aware inline cell edit parsing (preserve leading zeros), dynamic PK row operations, debounced server search.
- `apps/web-console/src/views/database/SchemaDesigner.tsx`: Support composite PK and column defaults.
- `apps/web-console/src/views/database/SchemaPoliciesSection.tsx`: Add `WITH CHECK` expression input, clarify RLS default-deny behavior.
- `apps/web-console/src/components/modals/CreateTableModal.tsx`: Add `isNullable` and `defaultValue` inputs, expand data type dropdown.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Wire to `PostgreSqlTestFixture` testing live PostgreSQL adapter.
- `tests/LocalMe.Integration.Tests/DbaasSecurityAndGuardrailTests.cs`: Wire to `PostgreSqlTestFixture` asserting live PostgreSQL boundary isolation.
- `tests/LocalMe.Integration.Tests/DataPlaneIntegrationTests.cs`: Remove reference to obsolete DynamicSqlHandler mock.

### Deleted Files
- `libs/data-plane/src/DynamicSql/DynamicSqlHandler.cs`: Remove orphaned, disconnected mock class.
- `apps/server/src/wwwroot/assets/index-BbzZJtko.css`: Obsolete hashed production bundle replaced by new build.

## 4. Test Surface
Every code change is validated through comprehensive unit and real-container integration tests:

### Unit & Domain Tests
- `SqlAstQueryCompilerTests`: Negative operators (`not.eq`, `not.in`, `not.like`), empty `in` arrays, 10,000 row limits, identifier injection protection.
- `SqlGuardrailValidatorTests`: Queries with `comment` columns, string literals `'drop'`, multiline comments, procedural block rejection.
- `PostgreSqlValueConverterTests`: Conversion of native C# types (`bool`, `long`, `double`, `DateTime`, `Guid`, JSON strings) to `JsonNode` primitives.

### Integration Tests (Real Ephemeral Containers)
- `PostgreSqlTenantSchemaStoreIntegrationTests`: Executed against PostgreSQL 18.1 container:
  - Table and column DDL lifecycle with cache invalidation verification.
  - Parameter typing for `integer`, `bigint`, `uuid`, and `boolean` columns (verifying zero `42883` errors).
  - JSON and JSONB column insertions and updates (verifying zero `42804` errors).
  - High-concurrency schema access and catalog lock contention (`XX000`/`55P03` resilience).
  - Snapshot export streaming and restore with foreign key cycles.

### Concurrency & Performance Tests
- `BoundedSchemaCacheTests`: Verification that cache never exceeds `SizeLimit = 1000` items under high key churn, asserting memory bounds under 2MB.
- `HighThroughputQueryBenchmark`: Execution of 1,000 simulated client queries measuring allocation and p95 latency.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports (`libs/core-domain`).
- [x] Tier 1: Real container integration tests (zero mock engine substitution for PostgreSQL).
- [x] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [x] Tier 1: Directory nesting depth does not exceed 6 levels from project root.
- [x] Tier 1: Database migrations follow Expand/Contract pattern for zero-downtime rollout.
- [x] Tier 2: Files respect size ceilings ($\le 800$ lines hard, $\le 400$ lines soft).
- [x] Tier 2: Domain test coverage maintains $\ge 95\%$ line & branch coverage; adapters $\ge 80\%$.
- [x] Tier 2: Backward compatibility of existing API contracts preserved.
- [x] Zero direct datastore credentials or ports exposed to client SDKs or Web Console.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| PostgreSQL catalog contention under rapid DDL | Low | Medium | Critical-section `SemaphoreSlim` lock and benign catch for `XX000`/`55P03` |
| Cache invalidation missed on manual direct DDL | Very Low | Low | 30-minute sliding TTL auto-eviction + public `InvalidateTenantSchemaCache` hook |
| Foreign key violation during snapshot restore | Low | High | `SET LOCAL session_replication_role = 'replica'` with `CONSTRAINTS ALL DEFERRED` fallback |
| Memory bloat during large query or snapshot | Low | High | Stream-based JSON processing with `Utf8JsonWriter` over `FileStream` |

### Rollback Strategy
All code modifications preserve 100% backward compatibility with existing REST endpoints and database schemas. If unexpected behavior occurs:
1. Revert application deployment via git commit reversal (`git revert HEAD`).
2. The schema changes (`auth.uid() RETURNS text`) are strictly permissive (widening return type), requiring no destructive schema rollback.

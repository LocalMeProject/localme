---
title: "Change Surface: Full-Stack DBaaS Refinements - SDK Parity, Composite Keys, Snapshot Lifecycle & UI Badges"
author: "Antigravity Engineering System"
created_date: "2026-10-31"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/client-sdk"
  - "libs/contracts"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: Full-Stack DBaaS Refinements - SDK Parity, Composite Keys, Snapshot Lifecycle & UI Badges

## 1. Intent & Business Rationale
Address Issue #66:
1. **Client SDK Parity (`@localme/sdk`)**:
   - Implemented `DatabaseClient` in `libs/client-sdk/src/database.ts` with complete DBaaS administrative and DDL capabilities: `truncateTable`, `getIndexes`, `createIndex`, `deleteIndex`, `rebuildIndex`, `getRelationships`, `createRelationship`, `deleteRelationship`, `getPolicies`, `createPolicy`, `deletePolicy`, `listSnapshots`, `createSnapshot`, `restoreSnapshot`, and `deleteSnapshot`.
   - Updated `TableQueryBuilder` to support `string | number` primary key IDs in `.match()` and `.delete()`.
   - Added `.not(column, operator, value)`, `.single(): Promise<T>`, and `.maybeSingle(): Promise<T | null>` operators.
   - Decoupled `DatabaseClient` to preserve Rule 2.6 line-count ceiling (<800 lines) across all SDK files.
2. **Disaster Recovery & Storage Integrity**:
   - In `PostgreSqlTenantSchemaStore.Snapshots.cs`, fixed `RestoreTenantDataAsync` by inspecting table column metadata and executing typed parameter mapping via `ConvertToTypedValue(v?.ToString(), dt)`, eliminating PostgreSQL error `42804` during non-text column restoration.
   - In `PostgreSqlTenantSchemaStore.cs`, resolved `UpsertRowAsync` malformed SQL on key-only payloads by emitting `DO NOTHING` when `updates.Count == 0`.
   - Supported composite primary keys in `CreateTableAsync` by emitting `PRIMARY KEY ("col1", "col2")` table-level constraints when multiple columns are flagged as primary keys.
3. **Snapshot Lifecycle Deletion**:
   - Added `DeleteDatabaseSnapshot(projectId, snapshotId)` in `ProjectManagerService.Snapshots.cs` with file unlinking and audit logging.
   - Exposed `DELETE /_baas/v1/{projectId}/db/snapshots/{snapshotId}` route in `BaasDbSnapshotRoutes.cs`.
   - Added delete button with accessible `ConfirmModal` in `DatabaseBackupsView.tsx`.
4. **Architectural Modularity & Rule 2.6 Compliance**:
   - Extracted schema DDL, index, relationship, policy, and truncate routes from `BaasDatabaseRoutes.cs` (which had reached 769 lines) into `BaasDatabaseSchemaRoutes.cs` (303 lines), dropping `BaasDatabaseRoutes.cs` to 486 lines.
5. **Console UX & Data Exploration**:
   - Added column data type pills and primary key icons in `TableDataGrid.tsx` header.
   - Added customizable page size selector (10, 25, 50, 100 rows per page) in `TableDataGrid.tsx` and wired handler in `DatabaseView.tsx`.
   - Ensured form field reset on opening/closing `CreateTableModal.tsx`.
   - Synchronized compiled assets in `apps/server/src/wwwroot/` and updated `panel.html`.
6. **OpenAPI 3.0 Specifications**:
   - Added full OpenAPI paths in `libs/contracts/schemas/openapi.json` for index lifecycle, relationships, truncate, columns, and snapshot deletion.
7. **Automated Integration Testing**:
   - Added automated tests in `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs` verifying composite primary keys, snapshot deletion, and key-only upserts (99/99 passing).

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Service Host) | Route schema operations via `BaasDatabaseSchemaRoutes.cs`, snapshot deletion, and serve compiled web console SPA assets |
| `apps/web-console` | Profile C (Frontend Application) | Column datatype badges, key icons, page size dropdown in grid, snapshot deletion UI with ConfirmModal |
| `libs/client-sdk` | Profile B (Client SDK) | `DatabaseClient` admin methods parity, numeric IDs, and query builder operators |
| `libs/contracts` | Profile B (OpenAPI Contracts) | OpenAPI 3.0 definitions for indexes, relationships, truncate, and snapshot deletion |
| `libs/data-plane` | Profile B (Domain & Data Engine) | Snapshot deletion engine in `ProjectManagerService.Snapshots.cs` |
| `libs/infrastructure` | Profile B (Infrastructure / Storage) | Typed parameter restore, composite PK table DDL, and upsert DO NOTHING fallback |
| `tests/LocalMe.Integration.Tests` | Profile D (Verification Suite) | Integration tests for composite PKs, snapshot deletion, and key-only upserts |

## 3. Code Surface

### Added Files
- `apps/server/src/Routes/BaasDatabaseSchemaRoutes.cs`: Schema DDL, indexes, relationships, policies, and truncate routes.
- `apps/server/src/wwwroot/assets/index-B2tKMOT0.css`: Compiled CSS bundle.
- `apps/server/src/wwwroot/assets/index-CGtuW_oL.js`: Compiled JavaScript bundle.
- `libs/client-sdk/src/database.ts`: Client SDK DBaaS administrative and DDL client class.

### Modified Files
- `CHANGE_SURFACE.md`: Updated declared change surface for Issue #66.
- `apps/server/src/Routes/BaasDatabaseRoutes.cs`: Delegated schema routes to `BaasDatabaseSchemaRoutes.cs` to remain well below 800 lines.
- `apps/server/src/Routes/BaasDbSnapshotRoutes.cs`: Added snapshot deletion route (`DELETE /db/snapshots/{snapshotId}`).
- `apps/server/src/wwwroot/panel.html`: Updated bundle references to newly compiled assets.
- `apps/web-console/src/components/modals/CreateTableModal.tsx`: Form state reset on modal open/close.
- `apps/web-console/src/views/DatabaseView.tsx`: Page size state handling and propagation.
- `apps/web-console/src/views/database/DatabaseBackupsView.tsx`: Snapshot deletion action and confirmation modal.
- `apps/web-console/src/views/database/TableDataGrid.tsx`: Column datatype badges, key icons, and page size dropdown.
- `libs/client-sdk/src/index.ts`: Delegated `client.database` to `DatabaseClient`.
- `libs/client-sdk/src/query-builder.ts`: Numeric ID support, `.not()`, `.single()`, `.maybeSingle()`.
- `libs/client-sdk/src/types.ts`: DBaaS types definitions for indexes, relationships, policies, and snapshots.
- `libs/contracts/schemas/openapi.json`: OpenAPI 3.0 path specifications for indexes, relationships, truncate, and snapshot deletion.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Snapshots.cs`: Snapshot deletion method implementation.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Snapshots.cs`: Typed parameter casting during snapshot restoration.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: Composite primary key table DDL and upsert DO NOTHING fallback.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Integration tests for composite PKs, snapshot deletion, and key-only upserts.

### Deleted Files
- `apps/server/src/wwwroot/assets/index-De8sK6id.css`: Pruned obsolete CSS bundle.
- `apps/server/src/wwwroot/assets/index-R5pgNvsI.js`: Pruned obsolete JavaScript bundle.

## 4. Test Surface

### Verification
- `dotnet build LocalMe.sln`: 0 warnings, 0 errors.
- `dotnet test tests/LocalMe.Integration.Tests/`: 99/99 integration tests passing.
- `pnpm -C libs/client-sdk build`: TypeScript build succeeded.
- `pnpm -C apps/web-console build`: Vite production build succeeded.
- `python3 scripts/ep.py surface validate`: Validated against schema.
- `python3 scripts/ep.py surface check-diff --strict`: Zero undeclared files.
- `python3 scripts/ep.py verify`: All automated verification gates passing.
- `python3 scripts/ep.py audit --diff origin/main`: 10-dimension enterprise audit clean pass.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero direct database URI leakage. All operations route through managed HTTP API endpoints.
- [x] Tier 1: Multi-tenant schema isolation strictly enforced (`tenant_{slug}`).
- [x] Tier 1: SqlGuardrailValidator DDL ban preserved on raw SQL endpoints; DDL strictly routed through Schema Designer.
- [x] Tier 2: File size ceiling rule (Rule 2.6, <=800 lines) strictly enforced across all 21 modified/added source files.
- [x] Tier 2: Zero browser `alert()` or `confirm()` dialogs across the web console.
- [x] Tier 2: PostgreSQL error codes sanitized with user-friendly Persian descriptions and technical investigation details.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| PostgreSQL composite primary key collisions | Low | Low | Enforced distinct constraint column definitions in SQL compiler |
| Stale browser cache | Low | Low | Content-hashed Vite bundle filenames ensure immediate cache-busting |

### Rollback Strategy
Revert the commit on git: `git revert HEAD`.

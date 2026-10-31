---
title: "Change Surface: Fix BigInt Datatype Mismatch 42804, Implement Index Lifecycle & Foreign Key Relations, Add Typed Record Insert Form, Fix RLS Policies, and Eliminate Browser Dialogs with Accessible Technical Error Modals"
author: "Antigravity Engineering System"
created_date: "2026-10-31"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: Fix BigInt Datatype Mismatch 42804, Implement Index Lifecycle & Foreign Key Relations, Add Typed Record Insert Form, Fix RLS Policies, and Eliminate Browser Dialogs with Accessible Technical Error Modals

## 1. Intent & Business Rationale
Address Issue #62:
1. Fix PostgreSQL error `42804: column "id" is of type bigint but expression is of type text` when inserting rows into tables with `bigint` / numeric / serial `id` columns via `POST /_baas/v1/{projectId}/rest/{table}`:
   - In `PostgreSqlTenantSchemaStore.cs`, removed unconditional injection of text string ID (`row_...`) when `id` is not supplied. Allowed auto-generating database sequences and identity columns to assign IDs naturally.
   - Added `ConvertToTypedValue` helper to properly type parameters according to column metadata (`long`, `decimal`, `bool`, `DateTime`, `Guid`).
2. Implement full Index Management lifecycle across backend and frontend:
   - Domain definition: `TableIndexDefinition.cs`.
   - Store & service implementation: `GetIndexesAsync`, `CreateIndexAsync`, `DropIndexAsync`, and `RebuildIndexAsync` (REINDEX).
   - Dedicated REST endpoints: `GET /db/tables/{table}/indexes`, `POST /db/tables/{table}/indexes`, `DELETE /db/tables/{table}/indexes/{indexName}`, `POST /db/tables/{table}/indexes/{indexName}/rebuild`.
   - Frontend UI: `SchemaIndexesSection.tsx` embedded in `SchemaDesigner.tsx` with column selectors, uniqueness toggle, reindexing spinner, and deletion confirmation.
3. Enable defining Foreign Key table relationships from the frontend and visualizing them in ER diagram:
   - Domain definition: `TableRelationshipDefinition.cs`.
   - Store & service implementation: `GetRelationshipsAsync`, `AddRelationshipAsync`, and `DropRelationshipAsync`.
   - Dedicated REST endpoints: `GET /db/tables/{table}/relationships`, `POST /db/tables/{table}/relationships`, `DELETE /db/tables/{table}/relationships/{constraintName}`.
   - Frontend UI: `SchemaRelationshipsSection.tsx` embedded in `SchemaDesigner.tsx` with source/target column dropdowns, `ON DELETE` and `ON UPDATE` actions (`CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`), and `SchemaDiagramView.tsx` visual relationship badges.
4. Replace raw JSON textarea for inserting rows with a type-aware structured record form:
   - Frontend modal: `InsertRecordModal.tsx` accepting `schemaColumns` and generating typed inputs (number, toggle boolean, datetime, json textarea, text) with nullability/required badges and primary key awareness.
   - Added toggle for direct JSON mode ("ورود مستقیم JSON") for power users.
5. Fix Row-Level Security (RLS) policy creation and runtime execution:
   - Syntax specialization: PostgreSQL requires `WITH CHECK (...)` for `INSERT` policies and `USING (...)` for `SELECT`/`DELETE` policies.
   - Provisioned `authenticated` and `anon` roles (`DO $$ BEGIN ... END $$;`), `auth` schema, and functions `auth.uid()` and `auth.role()` in `EnsureTenantSchemaAsync`.
   - Extracted policy storage logic to `PostgreSqlTenantSchemaStore.Policies.cs`.
6. Globally handle internal database errors and provide rich technical investigation details:
   - Created `BaasDatabaseErrorHelper.cs`: catches `PostgresException` codes (`42804`, `42703`, `23505`, `23503`, `23502`, `23514`, `42P01`) and produces Persian explanations, HTTP statuses (`400`, `404`, `409`), and technical details.
   - Replaced unhandled Kestrel crashes in `BaasDatabaseRoutes.cs` with structured JSON error responses (`{ error, code, detail, canInvestigate }`).
7. Complete elimination of primitive browser dialogs (`alert()` and `confirm()`):
   - Created `AlertModal.tsx`: accessible dialog with expandable technical investigation details (SQLSTATE, exception detail), copy button ("کپی جزییات خطا"), and type indicators.
   - Audited and eliminated 100% of `alert()` and `confirm()` calls across all views (`TopupModal.tsx`, `DatabaseView.tsx`, `SchemaDesigner.tsx`, `TableDataGrid.tsx`, `DatabaseBackupsView.tsx`, `EdgeFunctionsView.tsx`, `HostingView.tsx`, `IpgView.tsx`, `SettingsView.tsx`, `StorageView.tsx`, `AuthView.tsx`, and `App.tsx`).
8. Enforce Rule 2.6 line-count ceiling (<= 800 lines):
   - Split `PostgreSqlTenantSchemaStore` partial class into `.Indexes.cs`, `.Relationships.cs`, `.Snapshots.cs`, and `.Policies.cs`.
   - Extracted `BaasDatabaseErrorHelper.cs` from `BaasDatabaseRoutes.cs`.
   - Decoupled `DatabaseBackupsView.tsx` into a self-contained component.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Service Host) | Route database indexes, relationships, policies, format PostgreSQL exceptions with technical investigation details, host updated web console SPA bundles |
| `apps/web-console` | Profile C (Frontend Application) | Typed insert form, index management section, relationship foreign key manager, zero browser dialogs with AlertModal and ConfirmModal |
| `libs/core-domain` | Profile B (Domain & Data Engine) | Domain records for `TableIndexDefinition` and `TableRelationshipDefinition` |
| `libs/data-plane` | Profile B (Domain & Data Engine) | Database store contract signatures and `ProjectManagerService` forwarding for indexes, relations, and policies |
| `libs/infrastructure` | Profile B (Infrastructure / Storage) | PostgreSQL storage implementation for typed insert/update, index lifecycle, foreign key constraints, RLS policies, and auth schema roles |
| `tests/LocalMe.Integration.Tests` | Profile D (Verification Suite) | Integration tests covering index lifecycle, relationship foreign key lifecycle, policy drop/create, and typed numeric inserts |

## 3. Code Surface

### Added Files
- `apps/server/src/Routes/BaasDatabaseErrorHelper.cs`: Formatter for PostgreSQL exceptions mapping error codes to user-friendly messages and investigation details.
- `apps/server/src/wwwroot/assets/index-R5pgNvsI.js`: Production JavaScript bundle for Web Console.
- `apps/server/src/wwwroot/assets/index-De8sK6id.css`: Production CSS stylesheet for Web Console.
- `apps/web-console/src/components/modals/AlertModal.tsx`: Accessible dialog for errors with expandable technical investigation details and copy functionality.
- `apps/web-console/src/views/database/InsertRecordModal.tsx`: Type-aware structured form modal for inserting database records with raw JSON toggle.
- `apps/web-console/src/views/database/SchemaIndexesSection.tsx`: Table index lifecycle manager (list, create, rebuild, delete).
- `apps/web-console/src/views/database/SchemaRelationshipsSection.tsx`: Table foreign key relationship manager (list, create, delete, cascade rules).
- `libs/core-domain/src/Database/TableIndexDefinition.cs`: Domain model for index metadata.
- `libs/core-domain/src/Database/TableRelationshipDefinition.cs`: Domain model for foreign key constraints.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Indexes.cs`: PostgreSQL index implementation (get, create, drop, rebuild).
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Policies.cs`: PostgreSQL RLS policies implementation (get, create with INSERT/SELECT/DELETE syntax specialization, drop).
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Relationships.cs`: PostgreSQL foreign key relationships implementation (get, add, drop).
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Snapshots.cs`: PostgreSQL schema sizing and snapshot export/restore extracted partial.

### Modified Files
- `CHANGE_SURFACE.md`: Updated declared change surface for Issue #62 comprehensive DBaaS enhancements.
- `apps/server/src/Routes/BaasDatabaseRoutes.cs`: Wrapped endpoints in structured error handling and registered index, relationship, and policy routes.
- `apps/server/src/wwwroot/panel.html`: Updated bundle references to newly compiled assets.
- `apps/web-console/src/App.tsx`: Replaced project deletion browser confirm with accessible `ConfirmModal`.
- `apps/web-console/src/components/modals/TopupModal.tsx`: Replaced browser alert with inline validation message.
- `apps/web-console/src/types.ts`: Added `TableIndex` and `TableRelationship` interface definitions.
- `apps/web-console/src/views/AuthView.tsx`: Replaced user deletion browser confirm with accessible `ConfirmModal`.
- `apps/web-console/src/views/DatabaseView.tsx`: Replaced browser alerts with `AlertModal`, passed `schemaColumns` and `onInsertRecord` to `TableDataGrid`, decoupled backups.
- `apps/web-console/src/views/EdgeFunctionsView.tsx`: Replaced browser alerts and confirms with `AlertModal` and `ConfirmModal`.
- `apps/web-console/src/views/HostingView.tsx`: Replaced browser alerts and confirms with `AlertModal` and `ConfirmModal`.
- `apps/web-console/src/views/IpgView.tsx`: Replaced browser alert with inline error feedback.
- `apps/web-console/src/views/SettingsView.tsx`: Replaced browser alerts and confirms with `AlertModal` and `ConfirmModal`.
- `apps/web-console/src/views/StorageView.tsx`: Replaced browser alerts and confirms with `AlertModal` and `ConfirmModal`.
- `apps/web-console/src/views/database/DatabaseBackupsView.tsx`: Decoupled backups view into a self-contained component with `ConfirmModal` and `AlertModal`.
- `apps/web-console/src/views/database/SchemaDesigner.tsx`: Embedded `SchemaIndexesSection` and `SchemaRelationshipsSection`, removed browser alerts.
- `apps/web-console/src/views/database/SchemaDiagramView.tsx`: Fetched real foreign key relationships and rendered actual FK connection badges.
- `apps/web-console/src/views/database/TableDataGrid.tsx`: Replaced raw JSON modal with `InsertRecordModal`.
- `libs/data-plane/src/MultiTenancy/ITenantDatabaseStore.cs`: Added index, relationship, and policy contract methods.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`: Implemented forwarding methods for indexes, relationships, and policies.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: Converted to partial class, added `ConvertToTypedValue`, omitted auto-generated `id` on insert, provisioned auth schema and roles.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Added comprehensive integration tests for index lifecycle, relationship foreign keys, policies, and typed inserts.

### Deleted Files
- `apps/server/src/wwwroot/assets/index-D4vOVRfX.js`: Pruned old JavaScript bundle.
- `apps/server/src/wwwroot/assets/index-tjv4kZUo.css`: Pruned old CSS bundle.

## 4. Test Surface

### Verification
- `dotnet build LocalMe.sln`: 0 warnings, 0 errors.
- `dotnet test tests/LocalMe.Integration.Tests/`: 96/96 integration tests passing.
- `pnpm -C apps/web-console build`: 0 errors, Vite production build succeeded.
- `python3 scripts/ep.py surface validate`: Validated against schema.
- `python3 scripts/ep.py surface check-diff --strict`: Zero undeclared files.
- `python3 scripts/ep.py verify`: All automated verification gates passing.
- `python3 scripts/ep.py audit --diff origin/main`: 10-dimension enterprise audit clean pass.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero direct database URI leakage. All operations route through managed HTTP API endpoints.
- [x] Tier 1: Multi-tenant schema isolation strictly enforced (`tenant_{slug}`).
- [x] Tier 1: SqlGuardrailValidator DDL ban preserved on raw SQL endpoints; DDL strictly routed through Schema Designer.
- [x] Tier 2: File size ceiling rule (Rule 2.6, <=800 lines) strictly enforced across all 30 modified/added source files.
- [x] Tier 2: Zero browser `alert()` or `confirm()` dialogs in web-console.
- [x] Tier 2: PostgreSQL error codes sanitized with user-friendly Persian descriptions and technical investigation details.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| PostgreSQL foreign key constraint violations on delete | Low | Medium | Configurable `ON DELETE` cascading rules (`CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`) with Persian error mapping |
| Stale browser cache | Low | Low | Content-hashed Vite bundle filenames ensure immediate cache-busting |

### Rollback Strategy
Revert the commit on git: `git revert HEAD`.

---
title: "Change Surface: Fix Table Creation DDL Endpoint Routing, Isolate Table Sidebar to Grid, Modularize Views, and Wire Schema Actions"
author: "Antigravity Engineering System"
created_date: "2026-10-31"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "scripts"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: Fix Table Creation DDL Endpoint Routing, Isolate Table Sidebar to Grid, Modularize Views, and Wire Schema Actions

## 1. Intent & Business Rationale
Address Issue #57:
1. Fix table creation error from `/panel/{projectId}/database/schema` ("تغییر در ساختار جداول (CREATE) تنها از طریق بخش طراح ساختار (Schema Designer) مجاز می‌باشد"). The web console previously attempted to issue raw `CREATE TABLE` DDL queries to the sandboxed SQL query runner (`/_baas/v1/{slug}/sql/execute`), which intentionally denies DDL. Routed table creation directly to the dedicated schema management endpoint `POST /_baas/v1/{slug}/db/tables` with structured column definitions.
2. Extend backend routing in `BaasServiceRoutes.cs` and `BaasDatabaseRoutes.cs` to deserialize column lists on `POST /_baas/v1/{slug}/db/tables`, and emit realtime CDC `CREATE_TABLE` notifications via `OnTableEvent`.
3. Fix PostgreSQL column SQL generation in `PostgreSqlTenantSchemaStore.cs` so primary key columns do not emit conflicting `NULL` syntax.
4. Scope the DBaaS in-content sidebar ("جداول پروژه") and the studio top heading banner ("مدیریت پایگاه داده و جدول‌ها") strictly to the table editor (`grid`), giving `schema`, `sql`, `diagram`, and `backups` views full screen width.
5. Modularize large views (`DatabaseView.tsx`, `SchemaDesigner.tsx`, `BaasServiceRoutes.cs`) to strictly adhere to the 800-line ceiling (Rule 2.6). Extract `DatabaseBackupsView.tsx`, `SchemaPoliciesSection.tsx`, and `BaasDatabaseRoutes.cs`.
6. Add `"wwwroot"` exclusion to `scripts/audit-runner.py` to ensure minified production bundles are treated as compiled web assets rather than unminified source code.
7. Wire up actions on `SchemaDesigner`: table selector dropdown, "ایجاد جدول جدید", "بازخوانی", and RLS policy deletion backed by `ConfirmModal`.
8. Fix column addition in `DatabaseView` to use `POST /db/tables/{table}/columns` instead of raw `ALTER TABLE` SQL.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Service Host) | Route structured table creation DDL, modularize database routes into `BaasDatabaseRoutes.cs`, and host updated web console SPA bundles |
| `apps/web-console` | Profile C (Frontend Application) | Route table creation and column addition to dedicated schema endpoints, isolate sidebar and banner to grid view, modularize backups and policies into subviews |
| `libs/data-plane` | Profile B (Domain & Data Engine) | Realtime event notification for table creation |
| `libs/infrastructure` | Profile B (Infrastructure / Storage) | Generate valid PostgreSQL column syntax for primary keys |
| `scripts` | Profile E (Tooling & Governance) | Exclude `wwwroot` compiled web assets in audit-runner scanner |
| `tests/LocalMe.Integration.Tests` | Profile D (Verification Suite) | Verify table creation with custom column definitions and realtime event triggers |

## 3. Code Surface

### Added Files
- `apps/server/src/Routes/BaasDatabaseRoutes.cs`: Modularized BaaS database, REST, and SQL routing endpoint definitions.
- `apps/server/src/wwwroot/assets/index-D4vOVRfX.js`: Production JavaScript bundle for Web Console.
- `apps/server/src/wwwroot/assets/index-tjv4kZUo.css`: Production CSS stylesheet for Web Console.
- `apps/web-console/src/views/database/DatabaseBackupsView.tsx`: Extracted backups and snapshot management component.
- `apps/web-console/src/views/database/SchemaPoliciesSection.tsx`: Extracted RLS policies management component.

### Modified Files
- `CHANGE_SURFACE.md`: Declared change surface for table creation DDL routing, modularization, and UI decoupling.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: Delegated database routes to `BaasDatabaseRoutes.cs` to satisfy file size ceiling.
- `apps/server/src/wwwroot/panel.html`: Updated SPA bundle references to newly compiled assets.
- `apps/web-console/src/App.tsx`: Re-routed table creation to `POST /_baas/v1/{slug}/db/tables` and preserved active subview navigation.
- `apps/web-console/src/views/DatabaseView.tsx`: Restricted sidebar and banner to `grid` view, routed column addition to dedicated schema endpoint, extracted backups view.
- `apps/web-console/src/views/database/SchemaDesigner.tsx`: Added table selector dropdown, new table trigger, refresh button, and extracted RLS policies component.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`: Added `OnTableEvent` dispatch on table creation.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: Fixed column DDL generation for primary keys.
- `scripts/audit-runner.py`: Added `wwwroot` to `EXCLUDED_DIRS` and path filtering during diff-base audits.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Added integration test for `CreateTableAsync` with columns and event capture.

### Deleted Files
- `apps/server/src/wwwroot/assets/index-Bla-_g_0.js`: Pruned old JavaScript bundle.
- `apps/server/src/wwwroot/assets/index-CwNiYqPa.css`: Pruned old CSS bundle.

## 4. Test Surface

### Verification
- `dotnet test tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`: 93 integration tests passing.
- `pnpm -C apps/web-console build`: Clean TypeScript compilation and Vite bundling.
- `ep surface validate && ep surface check-diff --strict`: Strict change surface validation.
- `ep audit --diff origin/main`: 10-dimension enterprise audit clean pass.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero direct database URI leakage. All operations route through managed HTTP API endpoints.
- [x] Tier 1: SqlGuardrailValidator DDL ban preserved. Raw SQL endpoints reject DDL; DDL must use schema endpoints.
- [x] Tier 1: Pure domain logic untouched.
- [x] Tier 2: Realtime CDC notifications fired for table creation lifecycle events.
- [x] Tier 2: File size ceiling rule (Rule 2.6, <=800 lines) strictly enforced across all modified source files.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Incompatible column definition payload format | Low | Low | Deserializer handles missing or null columns gracefully falling back to default schema |
| Stale browser cache | Low | Low | Content-hashed Vite bundle filenames ensure immediate cache-busting |

### Rollback Strategy
Revert the commit on git: `git revert HEAD`.

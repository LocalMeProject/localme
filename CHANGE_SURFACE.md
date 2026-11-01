---
title: "Change Surface: DBaaS Dashboard, PostgreSQL Concurrency Fixes, Table Sync & Schema Designer UX Overhaul"
author: "Antigravity Engineering System"
created_date: "2026-11-01"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/infrastructure"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: DBaaS Dashboard, PostgreSQL Concurrency Fixes, Table Sync & Schema Designer UX Overhaul

## 1. Intent & Business Rationale
Address Issue #70:
1. **Fix PostgreSQL `XX000: tuple concurrently updated` in Schema Store**:
   - In `PostgreSqlTenantSchemaStore.cs`, resolved catalog update concurrency races on `pg_proc` and `pg_roles` by adding static in-memory caching (`_ensuredTenantSchemas`) and critical-section locking (`_schemaInitLock`).
   - Ensured global auth functions (`auth.uid()`, `auth.role()`) execute at most once per process lifetime, and wrapped DDL in graceful catch handlers for `XX000`, `55P03`, `23505`, preventing concurrent transaction conflicts on system catalogs.
   - Added cache invalidation helper `InvalidateTenantSchemaCache`.
2. **Table Switching Redundant Network Calls**:
   - In `DatabaseView.tsx`, removed `activeTable` from `fetchTables` callback dependencies. `GET /db/tables` is now called only once on initial mount or upon explicit user refresh / table creation, eliminating unnecessary roundtrips.
3. **Diagram to Grid Navigation with URL Parameter**:
   - In `DatabaseView.tsx`, integrated `useLocation` and `useNavigate` from `react-router-dom` to parse `?table=tableName` from the query string and synchronize with `activeTable`.
   - In `SchemaDiagramView.tsx` and `DatabaseDashboardView.tsx`, table selection triggers navigation to `/panel/:slug/database/grid?table=:tableName`.
4. **DBaaS Developer Dashboard (Default Landing Page)**:
   - Created `DatabaseDashboardView.tsx` (< 500 lines) with:
     - Developer KPI metrics: Total Tables, Estimated Total Rows, Database Engine (PostgreSQL 16 Multi-Tenant Isolated), Security & Isolation Status.
     - Quick Developer Action grid: Data Grid, SQL Studio, Schema Designer, ER Diagram.
     - Central Tables Overview table with name search, primary key badges, columns count, estimated rows, and instant action shortcuts.
     - Developer Connection & SDK integration panel with interactive TypeScript and cURL snippets.
   - Configured `DEFAULT_SUB_VIEWS['database'] = 'dashboard'` in `App.tsx` and updated subview routing.
5. **Schema Designer UX Overhaul ($\ge 10/12$)**:
   - Re-architected `SchemaDesigner.tsx` with clean tabbed navigation (`ستون‌ها`, `روابط و کلید خارجی`, `ایندکس‌ها`, `امنیت سطرها (RLS)`, `منطقه خطر`).
   - Added column search & filter bar for large schemas.
   - Added smart quick presets (`title`, `description`, `status`, `is_active`, `metadata`) in column creation form.
   - Enhanced column data type badges with distinct color palettes by category.
   - Added table header with table switcher, copy table name button, column and PK summary badges.
6. **SQL Editor Auto-Execution Guard**:
   - In `DatabaseView.tsx`, prevented automatic SQL execution on table selection or tab switch; template query is only initialized when editor is empty.
   - In `SqlQueryRunner.tsx`, added helpful "آماده برای اجرای کوئری" placeholder explaining explicit execution triggers (<kbd>Ctrl+Enter</kbd> or click).
7. **Sidebar & Heading Polish**:
   - In `Navigation.tsx`, increased Level 2 font size to `13px` and vertical gap between items to `space-y-1.5`.
   - Removed `"پایگاه داده رابطه‌ای"` badge and `prj_{project.slug}` from the headings in `DatabaseView.tsx`.
8. **Automated Verification**:
   - Added concurrent schema operations test in `DbaasConsoleStudioTests.cs` (100/100 tests passing).

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Service Host) | Serve updated web-console SPA assets in `wwwroot/` |
| `apps/web-console` | Profile C (Frontend Application) | Developer Dashboard view, Schema Designer tabbed UX, SQL execution guard, URL param navigation |
| `libs/infrastructure` | Profile B (Infrastructure / Storage) | PostgreSqlTenantSchemaStore schema caching and concurrency lock |
| `tests/LocalMe.Integration.Tests` | Profile D (Verification Suite) | Concurrent tenant schema access verification test |

## 3. Code Surface

### Added Files
- `apps/server/src/wwwroot/assets/index-BbzZJtko.css`: Compiled CSS bundle.
- `apps/server/src/wwwroot/assets/index-CxpgChir.js`: Compiled JavaScript bundle.
- `apps/web-console/src/views/database/DatabaseDashboardView.tsx`: DBaaS Developer Dashboard component.

### Modified Files
- `CHANGE_SURFACE.md`: Updated declared change surface for Issue #70.
- `apps/server/src/wwwroot/panel.html`: Updated bundle references to newly compiled assets.
- `apps/web-console/src/App.tsx`: Updated database default subview to dashboard and route mapping.
- `apps/web-console/src/components/Navigation.tsx`: Added dashboard to database module, increased font size and spacing.
- `apps/web-console/src/views/DatabaseView.tsx`: URL param table sync, table fetch debounce, header cleanup, dashboard rendering.
- `apps/web-console/src/views/database/SchemaDesigner.tsx`: Tabbed schema interface, search, presets, and type badges.
- `apps/web-console/src/views/database/SqlQueryRunner.tsx`: Query execution placeholder and explicit trigger guidance.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: Thread-safe cache and SemaphoreSlim locking for schema initialization.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Concurrent schema operations integration test.

### Deleted Files
- `apps/server/src/wwwroot/assets/index-B2tKMOT0.css`: Obsolete CSS bundle.
- `apps/server/src/wwwroot/assets/index-CGtuW_oL.js`: Obsolete JavaScript bundle.

## 4. Test Surface

### Verification
- `dotnet build LocalMe.sln`: 0 warnings, 0 errors.
- `dotnet test tests/LocalMe.Integration.Tests/`: 100/100 integration tests passing.
- `pnpm -C apps/web-console build`: Vite production build succeeded.
- `python3 scripts/ep.py surface validate`: Validated against schema.
- `python3 scripts/ep.py surface check-diff --strict`: Zero undeclared files.
- `python3 scripts/ep.py verify`: All automated verification gates passing.
- `python3 scripts/ep.py audit --diff origin/main`: 10-dimension enterprise audit clean pass.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero direct database URI leakage. All operations route through managed HTTP API endpoints.
- [x] Multi-tenancy: Strict isolation via tenant schemas (`prj_{slug}`) and RLS.
- [x] Zero browser `alert()` or `confirm()` calls.
- [x] Rule 2.6: All modified and added files strictly <= 800 physical lines.
- [x] Production merge remains strictly human-only.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| PostgreSQL concurrent catalog DDL conflicts | Very Low | Low | Static ConcurrentDictionary cache, SemaphoreSlim locking, and benign XX000 catch handler |
| Table selection state mismatch | Low | Low | URL search query synchronization with activeTable fallback to first table |
| Stale browser cache | Low | Low | Content-hashed Vite bundle filenames ensure immediate cache-busting |

### Rollback Strategy
In the event of an unexpected regression, run `git revert <commit-sha>` and redeploy `apps/server`. Reversion restores legacy un-tabbed schema designer and individual on-demand DDL execution without schema data corruption.


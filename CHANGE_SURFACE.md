---
title: "Change Surface: DBaaS Batch 2 — Web Console Developer Studio Overhaul"
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

# Change Surface: DBaaS Batch 2 — Web Console Developer Studio Overhaul

## 1. Intent & Business Rationale
1. Server-side pagination (`limit`, `offset`), column sorting, and text filter controls in `TableDataGrid.tsx`.
2. Inline cell editing, cell-level updates (PATCH/PUT), and schema-driven row insertion modal.
3. Schema Designer overhaul: Column drop, rename, and type alteration in `SchemaDesigner.tsx`.
4. Foreign key relation management, index creation UI, and Row Level Security (RLS) policies visual editor.
5. Interactive ER visualizer (`SchemaDiagramView.tsx`) mapping project tables, primary keys, and relationships.
6. SQL runner query history persistence in `localStorage`, `Ctrl+Enter` execution shortcut, and CSV/JSON export.
7. Replace native browser `window.confirm()` and `alert()` with styled, accessible `ConfirmModal.tsx`.
8. Table truncation and cascade drop controls with safety name-confirmation modal.
9. Dark/Light theme consistency and RTL layout padding adjustments across Database Studio.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/core-domain` | Profile A (Backend DDD Core) | Add `TablePolicyDefinition.cs` and extend column/index domain models |
| `libs/data-plane` | Profile A (Backend Data Plane) | Extend `ITenantDatabaseStore` contracts and `ProjectManagerService.Tables.cs` methods |
| `libs/infrastructure` | Profile A (Backend Persistence) | Implement DDL (add/drop/alter column, index, truncate, policies) in `PostgreSqlTenantSchemaStore.cs` |
| `apps/server` | Profile A (Backend Service Host) | Mount column alter/drop, index, truncate, and policy endpoints in `BaasServiceRoutes.cs` |
| `apps/web-console` | Profile B (Web Application) | Overhaul `TableDataGrid`, `SchemaDesigner`, `SqlQueryRunner`, add `SchemaDiagramView` and `ConfirmModal` |

## 3. Code Surface

### Added Files
- `apps/web-console/src/components/modals/ConfirmModal.tsx`: Accessible custom confirmation modal with danger and confirmation phrase options.
- `apps/web-console/src/views/database/SchemaDiagramView.tsx`: Interactive SVG / Canvas relational ER model visualizer.
- `libs/core-domain/src/Database/TablePolicyDefinition.cs`: Pure domain value object for PostgreSQL RLS policies.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Integration tests for column alter/drop, index creation, truncate, and policy management.

### Modified Files
- `CHANGE_SURFACE.md`: Declared blast radius and contracts for Batch 2.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: Endpoints for column drop/alter, index creation, truncate, and RLS policies.
- `apps/web-console/src/components/Navigation.tsx`: Add ER diagram subview link under Database studio.
- `apps/web-console/src/views/DatabaseView.tsx`: Integrate ER diagram tab, confirmation modals, and unified studio state.
- `apps/web-console/src/views/database/SchemaDesigner.tsx`: Column drop/rename/alter, FK/index management, RLS policies, truncate/drop.
- `apps/web-console/src/views/database/SqlQueryRunner.tsx`: Persistent history, keyboard shortcuts, and CSV/JSON exports.
- `apps/web-console/src/views/database/TableDataGrid.tsx`: Server pagination, sorting, filtering, inline editing, CSV/JSON exports.
- `libs/core-domain/src/Database/TenantDbQueryModels.cs`: Extended column properties for nullability and defaults.
- `libs/data-plane/src/MultiTenancy/ITenantDatabaseStore.cs`: Contracts for column mutation, indexes, truncation, and policies.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`: Data plane orchestrations for schema mutations.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: PostgreSQL DDL implementations with identifier sanitation.

## 4. Test Surface

### Unit & Domain Tests
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`:
  - `SchemaDesigner_AddAndDropColumn_Succeeds`
  - `SchemaDesigner_AlterColumnTypeAndRename_Succeeds`
  - `SchemaDesigner_CreateIndexAndTruncate_Succeeds`
  - `TableDataGrid_PaginationAndOrdering_ReturnsExpectedRows`

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports.
- [x] Tier 1: Zero direct database URI leakage.
- [x] Tier 1: DDL restricted strictly to Schema Designer backend routes.
- [x] Tier 2: Backward compatibility of existing API contracts preserved.
- [x] Tier 2: Responsive, accessible UI with zero broken styles.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Accidental table drop or truncation | Low | High | Require typing the exact table name in `ConfirmModal` before destructive actions |
| Column type alteration data loss | Medium | Medium | Clear warnings in Schema Designer and PostgreSQL type cast validation |
| Large table pagination performance | Low | Low | Server-side `LIMIT` and `OFFSET` parameterized queries |

### Rollback Strategy
Git branch reset: `git checkout main && git branch -D feat/dbaas-console-studio`.

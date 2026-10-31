---
title: "Change Surface: Sync Web Console Production Assets to Server wwwroot"
author: "Antigravity Engineering System"
created_date: "2026-10-31"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
---

# Change Surface: Sync Web Console Production Assets to Server wwwroot

## 1. Intent & Business Rationale
Synchronize compiled production Vite assets from `apps/web-console` to `apps/server/src/wwwroot` so that the deployed ASP.NET Core server serves the complete DBaaS Studio overhaul (TableDataGrid pagination/inline editing/export, SchemaDesigner DDL management, SchemaDiagramView ER visualizer, and ConfirmModal dialogs) without running a separate Node dev server.

Prune stale hashed bundles (`index-CnANRxnt.js`, `index-BO3ZkZKA.css`) to prevent asset bloat.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Service Host) | Host production web console SPA in static wwwroot directory |

## 3. Code Surface

### Added Files
- `apps/server/src/wwwroot/assets/index-Bla-_g_0.js`: Production JavaScript bundle for Web Console.
- `apps/server/src/wwwroot/assets/index-CwNiYqPa.css`: Production CSS stylesheet for Web Console.

### Modified Files
- `CHANGE_SURFACE.md`: Declared change surface for asset synchronization.
- `apps/server/src/wwwroot/panel.html`: Updated asset references to point to new bundle hashes.

### Deleted Files
- `apps/server/src/wwwroot/assets/index-BO3ZkZKA.css`: Pruned stale CSS bundle.
- `apps/server/src/wwwroot/assets/index-CnANRxnt.js`: Pruned stale JavaScript bundle.

## 4. Test Surface

### Verification
- `pnpm -C apps/web-console build`: Ensures dist assets match wwwroot assets.
- `dotnet test`: Ensures server compiles and all integration tests pass.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero direct database URI leakage.
- [x] Tier 1: Pure domain logic untouched.
- [x] Tier 2: Static asset hosting integrity maintained.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Stale asset caching in browser | Low | Low | Bundles use content-based hashing (`index-Bla-_g_0.js`) |

### Rollback Strategy
Git revert: `git checkout HEAD~1 -- apps/server/src/wwwroot`.

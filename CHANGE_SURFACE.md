---
title: "Change Surface: Console Production Integration, Resilient PostgreSQL SSL & Runflare Deployment"
author: "Antigravity Engineering System"
created_date: "2026-10-30"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/web-console"
  - "apps/server"
  - "libs/infrastructure"
---

# Change Surface: Console Production Integration, Resilient PostgreSQL SSL & Runflare Deployment

## 1. Intent & Business Rationale
1. Fix production web-console delivery by integrating the compiled Vite/React Supabase developer console directly into `apps/server/src/wwwroot/panel.html` and `assets/`, ensuring that `/panel` and `/console` routes serve the modern design system rather than stale legacy static HTML.
2. Fix PostgreSQL connection string parsing in `PostgreSqlProjectStore.cs` and `Program.cs` to support both URI and ADO.NET connection strings, resilient SSL modes (`SSL Mode=Prefer`), and structured JSON error responses instead of unhandled 500 HTML exceptions on database routes.
3. Update `scripts/deploy-runflare.sh` to compile `apps/web-console` and synchronize all production static assets before publishing the .NET server container.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/web-console` | Profile B (Web Application) | Base URL configuration, live project API sync, and multi-prefix route parser |
| `apps/server` | Profile A (Backend Service) | Panel/console routing, structured JSON database error handling, and webroot asset delivery |
| `libs/infrastructure` | Profile C (Shared Library) | Resilient PostgreSQL connection string normalization and SSL mode resolution |

## 3. Code Surface

### Added Files
- `apps/server/src/wwwroot/assets/`

### Modified Files
- `apps/server/src/Program.cs`
- `apps/server/src/Routes/BaasServiceRoutes.cs`
- `apps/server/src/wwwroot/panel.html`
- `apps/web-console/package.json`
- `apps/web-console/index.html`
- `apps/web-console/tailwind.config.js`
- `apps/web-console/src/index.css`
- `apps/web-console/src/App.tsx`
- `apps/web-console/vite.config.ts`
- `apps/web-console/src/views/OverviewView.tsx`
- `apps/web-console/src/views/AuthView.tsx`
- `apps/web-console/src/views/EdgeFunctionsView.tsx`
- `apps/web-console/src/views/StorageView.tsx`
- `apps/web-console/src/views/IpgView.tsx`
- `apps/web-console/src/views/HostingView.tsx`
- `apps/web-console/src/views/ComplianceView.tsx`
- `apps/web-console/src/views/TelemetryView.tsx`
- `apps/web-console/src/views/SettingsView.tsx`
- `apps/web-console/src/views/WorkspaceHubView.tsx`
- `apps/web-console/src/views/DatabaseView.tsx`
- `apps/web-console/src/views/database/TableDataGrid.tsx`
- `apps/web-console/src/views/database/SchemaDesigner.tsx`
- `apps/web-console/src/views/database/SqlQueryRunner.tsx`
- `apps/web-console/src/components/Header.tsx`
- `apps/web-console/src/components/Navigation.tsx`
- `apps/web-console/src/components/modals/DeployFunctionModal.tsx`
- `apps/web-console/src/components/modals/CreateBucketModal.tsx`
- `apps/web-console/src/components/modals/AddUserModal.tsx`
- `apps/web-console/src/components/modals/AddDomainModal.tsx`
- `apps/web-console/src/components/modals/TopupModal.tsx`
- `apps/web-console/src/components/modals/CreateProjectModal.tsx`
- `apps/web-console/src/components/modals/CreateTableModal.tsx`
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`
- `scripts/deploy-runflare.sh`
- `pnpm-lock.yaml`

## 4. Test Surface
- `tests/LocalMe.Integration.Tests/TenantDatabaseEngineTests.cs`: Full backend integration test regression suite.
- `apps/web-console/src/`: Full TypeScript typecheck suite (`pnpm -C apps/web-console lint`) and Vite production bundle build (`pnpm -C apps/web-console build`).
- `audit-runner.py`: 10-Dimension Enterprise Audit check (`python3 scripts/ep.py audit --diff origin/main...HEAD`).

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Zero runtime dependencies on external blocked CDNs.
- [x] Tier 2: Supabase custom design system tokens enforced (#0f0f0f, #171717, #242424, #3ECF8E, 4px grid, Inter, Source Code Pro, zero emojis).
- [x] Tier 2: Strict LTR isolation (`dir="ltr"`, `font-mono`) for all code, SQL, schemas, and technical data cells.
- [x] Tier 2: Maximum file line ceiling ($\le 800$ lines) respected across all touched files.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| CSS class typo in tailwind markup | Low | Low | Automated `pnpm build` verification |
| Unintended layout shift on RTL/LTR boundary | Low | Low | Strict `dir="ltr"` encapsulation on mono containers |

### Rollback Strategy
Git branch reset: `git checkout main && git branch -D feat/supabase-theme-overhaul`.

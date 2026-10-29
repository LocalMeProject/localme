---
title: "Change Surface: Full-Console Supabase Custom Design System & Localized Font Assets"
author: "Antigravity Engineering System"
created_date: "2026-10-30"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/web-console"
---

# Change Surface: Full-Console Supabase Custom Design System & Localized Font Assets

## 1. Intent & Business Rationale
Complete the 100% end-to-end frontend UI unification of the LocalMe Developer Console into the Supabase design system:
1. Localize all font assets via `@fontsource/inter` and `@fontsource/source-code-pro` to avoid runtime dependencies on external CDNs or Google Fonts (which are throttled/blocked by Iranian DPI).
2. Drop custom CSS utility classes from `index.css`, replacing them with pure standard Tailwind CSS utilities (`rounded-full`, `bg-[#3ECF8E]`, `dir="ltr"`).
3. Overhaul all remaining 9 views (`OverviewView`, `AuthView`, `EdgeFunctionsView`, `StorageView`, `IpgView`, `HostingView`, `ComplianceView`, `TelemetryView`, `SettingsView`) and 5 modals (`DeployFunctionModal`, `CreateBucketModal`, `AddUserModal`, `AddDomainModal`, `TopupModal`) to the native near-black surfaces (`#0f0f0f` ground, `#171717` card surfaces, `#242424` borders), emerald accents (`#3ECF8E`), pill-shaped CTAs, Lucide icons, and zero emojis.
4. Maintain strict LTR isolation container (`dir="ltr"`, `font-mono`) for code snippets, JSON payloads, URLs, hashes, and technical data.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/web-console` | Profile B (Web Application) | Complete Supabase design system overhaul across all views, modals, and local font bundling |

## 3. Code Surface

### Added Files
None

### Modified Files
- `apps/web-console/package.json`
- `apps/web-console/src/index.css`
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
- `apps/web-console/src/App.tsx`
- `apps/web-console/src/components/Header.tsx`
- `apps/web-console/src/components/Navigation.tsx`
- `apps/web-console/src/components/modals/DeployFunctionModal.tsx`
- `apps/web-console/src/components/modals/CreateBucketModal.tsx`
- `apps/web-console/src/components/modals/AddUserModal.tsx`
- `apps/web-console/src/components/modals/AddDomainModal.tsx`
- `apps/web-console/src/components/modals/TopupModal.tsx`
- `apps/web-console/src/components/modals/CreateProjectModal.tsx`
- `apps/web-console/src/components/modals/CreateTableModal.tsx`
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

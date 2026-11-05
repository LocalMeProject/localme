---
title: "Change Surface: Drop Multi-Tenant Terminology and Backend Stack Exposure"
author: "sinavali"
created_date: "2026-11-05"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/data-plane"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface

## 1. Intent & Business Rationale
- Completely remove "چندمستاجره" and "چند مستاجره" across user-facing documentation, landing pages, compare guides, terms, console, and discovery files.
- Eliminate explicit mentions of underlying backend stacks (PostgreSQL 18, Redis, ASP.NET, .NET 10, Java, Kestrel, etc.) in user-facing marketing, docs, console, and HTTP responses.
- Configure Kestrel web host to omit the `Server: Kestrel` header.
- Clean up `/_baas/v1/config` to return generic cloud platform metadata.
- Rebuild web-console and synchronize clean assets into wwwroot.
- Verify through integration tests that forbidden terms are strictly absent from discoverability and SEO assets.

## 2. Affected Monorepo Projects
- `apps/server`
- `apps/web-console`
- `libs/data-plane`
- `tests/LocalMe.Integration.Tests`

## 3. Code Surface
### Modified Files
- `apps/server/src/Program.cs`
- `apps/server/src/Routes/AuthHelper.cs`
- `apps/server/src/Routes/BaasProjectRoutes.cs`
- `libs/data-plane/src/Admin/DynamicDiscoveryService.cs`
- `apps/server/src/wwwroot/styles.css`
- `apps/server/src/wwwroot/index.html`
- `apps/server/src/wwwroot/docs.html`
- `apps/server/src/wwwroot/faq.html`
- `apps/server/src/wwwroot/benchmarks.html`
- `apps/server/src/wwwroot/compare/localme-vs-firebase-iran.html`
- `apps/server/src/wwwroot/compare/localme-vs-supabase-iran.html`
- `apps/server/src/wwwroot/features/auth.html`
- `apps/server/src/wwwroot/features/database.html`
- `apps/server/src/wwwroot/features/edge-functions.html`
- `apps/server/src/wwwroot/features/storage.html`
- `apps/server/src/wwwroot/features/telemetry.html`
- `apps/server/src/wwwroot/admin.html`
- `apps/server/src/wwwroot/admin.js`
- `apps/server/src/wwwroot/auth.html`
- `apps/server/src/wwwroot/panel.html`
- `apps/server/src/wwwroot/terms.html`
- `apps/server/src/wwwroot/privacy.html`
- `apps/server/src/wwwroot/404.html`
- `Dockerfile`
- `scripts/deploy-runflare.sh`
- `apps/server/src/wwwroot/llms.txt`
- `apps/server/src/wwwroot/llms-full.txt`
- `apps/server/src/wwwroot/robots.txt`
- `apps/server/src/wwwroot/sitemap.xml`
- `apps/web-console/src/App.tsx`
- `apps/web-console/src/dagEngine.ts`
- `apps/web-console/src/views/database/DatabaseDashboardView.tsx`
- `apps/server/src/wwwroot/assets/index-BMIrIwJf.js`
- `apps/server/src/wwwroot/assets/index-DIO1YLSc.js`
- `tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`
- `tests/LocalMe.Integration.Tests/DiscoverabilityAndSeoTests.cs`
- `tests/LocalMe.Integration.Tests/SeoAndSecurityOverhaulTests.cs`

## 4. Test Surface
### Unit & Integration Suites
- `tests/LocalMe.Integration.Tests/DiscoverabilityAndSeoTests.cs`
- `tests/LocalMe.Integration.Tests/SeoAndSecurityOverhaulTests.cs`
- `tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`

## 5. Invariants
- Zero ZWNJ (`\u200c`) characters in any HTML files.
- Zero user-facing mentions of "چندمستاجره" or "چند مستاجره".
- Zero public exposure of backend technology stack names (Postgres, PostgreSQL, Redis, .NET, ASP.NET, Kestrel).
- 100% backward-compatible API contracts for Client SDKs.

## 6. Risk Matrix
- Rollback: Revert commits via standard git rollback.
- Blast radius bounded strictly to declared Code Surface.

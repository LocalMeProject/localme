---
title: "Change Surface: SEO, AEO, Performance & Security Overhaul"
author: "sinavali"
created_date: "2026-11-03"
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
Complete implementation of SEO, AEO, Core Web Vitals performance, and multi-tenant security lockdown.
- Fix public exposure and authentication bypass on `/panel` and `/_baas/v1/projects`.
- Eliminate Soft 404s with dedicated 404 response handler.
- Canonical domain 301 normalization for `www.localme.ir` to `localme.ir` and trailing slashes.
- Enable Kestrel response compression (Gzip / Brotli) and static asset `Cache-Control`.
- Inject standard HTTP security headers (HSTS, nosniff, SAMEORIGIN, Referrer-Policy).
- Self-host Vazirmatn font locally; eliminate render-blocking Google Fonts across all pages.
- Correct document heading hierarchy (unify 17 `<h1>` tags on `docs.html` to a single top-level `<h1>`, add `<h2>` to `faq.html`).
- Add `rel="nofollow"` to internal links targeting disallowed routes.
- Standardize `llms.txt` and generate consolidated `llms-full.txt` according to llmstxt.org.
- Add modern AI search engine crawlers (`OAI-SearchBot`, `Claude-Web`, `Meta-ExternalAgent`) to robots.txt.
- Add Schema.org `WebSite` + `SearchAction`, enhance `Organization`, and add publication timestamps to `TechArticle`.
- Add dedicated `privacy.html`, `terms.html`, and `404.html`.

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
- `apps/server/src/wwwroot/assets/index-BMIrIwJf.js`
- `apps/server/src/wwwroot/assets/index-Zbcr_arX.js`
- `tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`
- `tests/LocalMe.Integration.Tests/SeoAndSecurityOverhaulTests.cs`

## 4. Test Surface
### Unit & Integration Suites
- `tests/LocalMe.Integration.Tests/SeoAndSecurityOverhaulTests.cs`
- `tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`

## 5. Invariants
- Zero unauthenticated data leakage across multi-tenant boundaries.
- Non-root invalid paths return explicit HTTP 404 status.
- Zero render-blocking external font dependencies for domestic network resilience.
- 100% backward-compatible API contracts for Client SDKs.

## 6. Risk Matrix
- Rollback: Revert commits via standard git rollback.
- Blast radius bounded strictly to declared Code Surface.

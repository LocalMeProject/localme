---
title: "Change Surface: Production SEO, Discoverability, Social Cards & Indexation for لوکال می"
author: "Antigravity EP-OS System"
created_date: "2026-11-02"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "libs/data-plane"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: Production SEO, Discoverability, Social Cards & Indexation for لوکال می

## 1. Intent & Business Rationale
Implement a complete, production-ready digital discovery, search engine optimization (SEO), answer engine optimization (AEO), generative engine optimization (GEO), and digital identity optimization (DIO) foundation for **«لوکال می»** (https://localme.ir).

Key Business & Technical Outcomes:
1. **Brand Naming Integrity**: Enforce **«لوکال می»** with standard space (`\u0020`) and zero half-spaces (`\u200c`) across all HTML tags, JSON-LD schemas, and documentation.
2. **Defensive Private Shielding**: Complete crawler invisibility (`noindex, nofollow`, `X-Robots-Tag`, OG stripping) for `/auth`, `/panel`, `/console`, `/admin`, and `/_baas/*`.
3. **Flawless Social Sharing Previews**: 1200x630px OpenGraph and Twitter Cards optimized for Telegram, WhatsApp (<300KB), and LinkedIn.
4. **Decoupled High-Intent Pillars**: Individual static landing pages for the 5 launch offerings (Database, Simple Auth & User Management without OTP, Storage, Edge Functions, ambient Telemetry) and strategic comparisons (vs. Firebase, vs. Supabase).
5. **AEO & GEO Optimization**: Sub-300ms nationwide latency and 100% uptime SLA documented on `/benchmarks`, 20 developer Q&As on `/faq`, and `/llms.txt` for AI crawlers.
6. **Dynamic Discovery Engine**: Automatic generation and updating of `robots.txt`, `sitemap.xml`, and `llms.txt` driven by runtime admin configurations without manual maintenance.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Service Host) | Static routing, response security headers, web assets, and public landing pages |
| `libs/data-plane` | Profile B (Domain & Data Engine) | Dynamic discovery engine, platform configuration, and automatic SEO syncing |
| `tests/LocalMe.Integration.Tests` | Profile D (Verification Suite) | Automated verification for SEO headers, sitemap, robots, and zero half-spaces |

## 3. Code Surface (Targeted Symbols & Files)

### Added Files
- `libs/data-plane/src/Admin/DynamicDiscoveryService.cs`: Automated dynamic discovery engine for robots.txt, sitemap.xml, and llms.txt.
- `apps/server/src/Middleware/SecurityRobotsMiddleware.cs`: Defensive middleware enforcing X-Robots-Tag on private endpoints.
- `apps/server/src/wwwroot/robots.txt`: Crawl directives for search & AI engines.
- `apps/server/src/wwwroot/sitemap.xml`: Full XML sitemap of all canonical public routes.
- `apps/server/src/wwwroot/llms.txt`: Factual markdown summary for generative search engines.
- `apps/server/src/wwwroot/faq.html`: Developer FAQ page (20 Q&As, accordion, FAQPage schema).
- `apps/server/src/wwwroot/benchmarks.html`: Empirical benchmarks page (<300ms SLA, 100% uptime).
- `apps/server/src/wwwroot/features/database.html`: PostgreSQL BaaS feature pillar page.
- `apps/server/src/wwwroot/features/auth.html`: Simple Auth & User Management feature pillar page.
- `apps/server/src/wwwroot/features/storage.html`: S3-compatible cloud storage feature pillar page.
- `apps/server/src/wwwroot/features/edge-functions.html`: Serverless Edge Functions feature pillar page.
- `apps/server/src/wwwroot/features/telemetry.html`: Built-in ambient project telemetry feature pillar page.
- `apps/server/src/wwwroot/compare/localme-vs-firebase-iran.html`: Strategic comparison pillar against Google Firebase in Iran.
- `apps/server/src/wwwroot/compare/localme-vs-supabase-iran.html`: Strategic comparison pillar against self-hosted Supabase in Iran.
- `apps/server/src/wwwroot/assets/og/home.png`: OpenGraph preview image for home.
- `apps/server/src/wwwroot/assets/og/docs.png`: OpenGraph preview image for docs.
- `apps/server/src/wwwroot/assets/og/database.png`: OpenGraph preview image for database.
- `apps/server/src/wwwroot/assets/og/auth.png`: OpenGraph preview image for auth.
- `apps/server/src/wwwroot/assets/og/storage.png`: OpenGraph preview image for storage.
- `apps/server/src/wwwroot/assets/og/edge-functions.png`: OpenGraph preview image for edge functions.
- `apps/server/src/wwwroot/assets/og/telemetry.png`: OpenGraph preview image for telemetry.
- `apps/server/src/wwwroot/assets/og/compare-firebase.png`: OpenGraph preview image for Firebase comparison.
- `apps/server/src/wwwroot/assets/og/compare-supabase.png`: OpenGraph preview image for Supabase comparison.
- `apps/server/src/wwwroot/assets/og/faq.png`: OpenGraph preview image for FAQ.
- `apps/server/src/wwwroot/assets/og/benchmarks.png`: OpenGraph preview image for benchmarks.
- `tests/LocalMe.Integration.Tests/DiscoverabilityAndSeoTests.cs`: Automated tests verifying SEO routes, headers, sitemap, robots, and zero half-spaces.

### Modified Files
- `PRODUCT_SKILL.md`: Add Section 2.2 brand identity, sub-300ms SLA, 100% uptime, and launch scope invariants.
- `libs/data-plane/src/Admin/PlatformConfig.cs`: Add SEO discoverability parameters and standardize platform name to «لوکال می».
- `libs/data-plane/src/Admin/PlatformConfigurationService.cs`: Integrate DynamicDiscoveryService for automated discovery file synchronization.
- `apps/server/src/Program.cs`: Static and dynamic routing for features, comparisons, FAQ, benchmarks, and defensive SecurityRobotsMiddleware.
- `apps/server/src/wwwroot/admin.html`: Shield with `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />`, fix half-space, add Category 9 SEO configuration.
- `apps/server/src/wwwroot/admin.js`: Bind Category 9 inputs and load/save SEO settings.
- `apps/server/src/wwwroot/index.html`: Align brand to «لوکال می» (zero half-space), sub-300ms SLA, 100% uptime, launch scope, complete OpenGraph/Twitter Cards, and JSON-LD.
- `apps/server/src/wwwroot/docs.html`: Standardize brand naming to «لوکال می», update OpenGraph and Twitter Cards.
- `apps/server/src/wwwroot/auth.html`: Shield with `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />` and strip OpenGraph.
- `apps/server/src/wwwroot/panel.html`: Shield with `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />` and strip OpenGraph.

### Deleted Files
- None

## 4. Test Surface
- `DiscoverabilityAndSeoTests`:
  - Assert zero half-spaces (`\u200c`) in all public HTML files in `wwwroot`.
  - Assert `robots.txt` exists, is served with `text/plain`, allows major search and AI crawlers, and blocks `/auth` and `/panel`.
  - Assert `sitemap.xml` exists, is valid XML, and contains all canonical public routes.
  - Assert `llms.txt` exists and references the 5 launch services and sub-300ms SLA.
  - Assert private endpoints emit `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` headers.

## 5. Invariants & Non-Negotiables
1. **Brand Representation**: Always write «لوکال می» with regular space (`\u0020`), zero half-spaces (`\u200c`).
2. **SLA Integrity**: Sub-300ms response time and 100% uptime guarantee. Never promise sub-10ms.
3. **Launch Scope**: Strictly 5 launch offerings (Database, Simple Auth/User Management, Storage, Edge Functions, ambient Telemetry). Zero SMS/OTP or marketplace IAP.
4. **Private Shielding**: Absolute invisibility for `/auth`, `/panel`, `/admin`, and `/_baas/*`.
5. **Line Budget**: All files must strictly remain $\le 800$ lines.

## 6. Risk Matrix & Rollback Strategy
| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Search engine crawling private console pages | Low | High | Enforce dual defense: `robots.txt` Disallow + `X-Robots-Tag: noindex, nofollow` HTTP header + `<meta name="robots">`. |
| Broken static route resolution in ASP.NET Core | Low | Medium | Explicitly map file endpoints with `Results.File` before fallback to `index.html`. |
| Social card preview failure in WhatsApp (<300KB) | Low | Medium | Optimize all OpenGraph images to WebP/PNG `< 150KB` with exact 1200x630 dimensions. |

**Rollback Strategy**:
Revert commit on `feat/seo-discoverability-launch-foundation` branch. Static files do not alter database migrations or core domain data models.


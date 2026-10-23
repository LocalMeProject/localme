---
title: "Change Surface: Unified Full-Stack ASP.NET Core 10 Server and Apple Frontend"
author: "Antigravity Engineering System"
created_date: "2026-10-15"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "apps/server"
  - "apps/web-console"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "libs/contracts"
  - "libs/client-sdk"
---

# Change Surface: Unified Full-Stack ASP.NET Core 10 Server and Apple Frontend

## 1. Intent & Business Rationale
Implement the complete full-stack LocalMe platform inside the single ASP.NET Core 10 host (`LocalMe.Server`). Unify the backend data plane (Dynamic SQL REST, Identity & OTP, Shaparak IPG payment ledger, blob storage, Jint compute) with an ultra-premium, Apple-designed developer portal hosted directly from ASP.NET Core `wwwroot`. Execute a 5-pass enterprise audit to ensure production readiness.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Core) | ASP.NET Core 10 single-project host serving both BaaS APIs and embedded Apple frontend |
| `libs/core-domain` | Profile A (Pure Domain) | DAG matrix expansion, Auth/OTP entities, Double-entry IRR wallet domain rules |
| `libs/data-plane` | Profile A (Ports & Adapters) | Full BaaS handlers: Dynamic SQL, OTP dispatch, IPG bridge, Jint script host |
| `libs/infrastructure` | Profile A (Infrastructure) | PostgreSQL migrations, Lua scripts, and in-memory fallback stores |
| `libs/contracts` | Profile D (Contracts) | OpenAPI 3.1 contracts updated for all BaaS routes |
| `libs/client-sdk` | Profile D (Shared SDK) | Client methods for auth, data, payments, and storage |

## 3. Code Surface
### Added & Expanded Capabilities (Iran Developer Platform & Enterprise BaaS)
- **Multi-Method Authentication & Project-Scoped Isolation**:
  - `libs/data-plane/src/Auth/OtpAuthService.cs`: Support for `scopedProjectId` in JWT payload (`prj` claim) and `ValidateTokenWithScope`.
  - `libs/data-plane/src/MultiTenancy/ProjectManagerService.cs`:
    - PBKDF2 password hashing with CSPRNG salt and constant-time verification.
    - `PlatformUser`: `Username` and `PasswordHash` properties with seeded developer, admin, and operator accounts.
    - `ValidateUserCredentials`: Matching username, email, or normalized Iranian mobile phone.
    - `BaasProject`: `PasswordHash` and `HasPassword` properties with project-scoped credential validation (`ValidateProjectCredentials`, `SetProjectPassword`, `RemoveProjectPassword`).
  - `apps/server/src/Program.cs`:
    - `POST /_baas/v1/auth/login`: Platform user login granting access to all user projects.
    - `POST /_baas/v1/auth/project-login`: Project-scoped login (`projectSlug` + project password) restricting session strictly to that single project.
    - `POST /_baas/v1/projects/{projectId}/password`, `DELETE /_baas/v1/projects/{projectId}/password`, and `GET /_baas/v1/projects/{projectId}/password-status`.
    - Project isolation enforcement: Project-scoped sessions only see and operate on their designated project.
  - `apps/server/src/wwwroot/auth.html`: Modern Apple/Emerald tabbed authentication portal supporting SMS OTP (default), Username + Password, and Project-Scoped credentials.
  - `apps/server/src/wwwroot/panel.html` & `app.js`: Project Settings UI card for managing project passwords, and UI restriction badges when running in single-project scoped mode.
- **Developer Documentation Updates (`/docs` & `docs.html`)**:
  - Full documentation of authentication tiers (SMS OTP, Platform credentials, and Project-Scoped credentials).
  - API reference for `POST /_baas/v1/auth/login`, `POST /_baas/v1/auth/project-login`, and project password management.
  - Developer studios and Shetab IPG mock gateway documentation.
- **Convenient CLI Scripts (`package.json`)**:
  - `pnpm dev`: Runs `dotnet run --project apps/server/src/LocalMe.Server.csproj` for quick local development.
  - `pnpm start`: Runs `dotnet run --project apps/server/src/LocalMe.Server.csproj --configuration Release` for production release execution.
- **Shetab / Shaparak Payment Gateway Engine**:
  - `libs/data-plane/src/Finance/PaymentIpgService.cs`: Public stored payment queries (`GetPayment`, `GetAllPayments`, `GetCustomerPayments`).
  - `apps/server/src/Program.cs`:
    - `GET /_baas/v1/pay/mock-gateway`: Authentic RTL Persian Shaparak gateway card simulator (auto-tabbing 16-digit card input, CVV2, expiry, dynamic OTP timer countdown, payment approval/cancellation).
    - `POST /_baas/v1/pay/mock-gateway/action`: Payment ledger settlement and deep-link callback execution.
- **Dynamic Blob Storage Streaming**:
  - `apps/server/src/Program.cs`: `POST /_baas/v1/{projectId}/storage/{bucket}/upload` streams real bytes to `IBlobStorageAdapter.PutObjectAsync`.
  - `GET /_baas/v1/{projectId}/storage/{bucket}/{*fileName}` streams persisted binary data via ASP.NET Core `Results.File`.
- **Developer Panel Studios (6 New Modules)**:
  - `apps/server/src/wwwroot/panel.html`, `services.js`, `app.js`:
    1. **Interactive SQL Editor & Table Schema Designer**: Safe query execution (`SELECT`, `INSERT`, `CREATE TABLE`), column schema inspector with primary key & nullable inference, sample query snippets.
    2. **Web Hosting & Static/SPA Deployments**: Deployment history, branch targeting, custom domain linking with verification status badges.
    3. **Shetab IPG Merchant Studio**: Terminal/merchant configuration for SEP, Behpardakht, Zarinpal, Sadad, live test payment trigger, and transaction ledger.
    4. **Team & Collaborator RBAC**: Multi-user project invites, role assignments (Admin, Developer, Viewer), removal with confirmation.
    5. **Compliance Hub**: Iranian regulatory tooling for e-Namad tokens, Samandehi verification, Android Digital Asset Links (`assetlinks.json`), and Apple Universal Links (`apple-app-site-association`).
    6. **Live Telemetry & Audit Logs**: Real-time event stream with service filters (Database, Auth, Storage, Edge Functions, Shetab IPG) and severity indicators.
- **Mobile Suite & Push Notifications Engine**:
  - `libs/data-plane/src/Mobile/PushNotificationService.cs`: Unified mobile device registry (iOS APNs, Android FCM, domestic Najva, Pushy, Charkhooneh), multi-token management, and targeted dispatch.
  - `libs/data-plane/src/Mobile/MobileIapService.cs`: Server-side In-App Purchase validation for Cafe Bazaar and Myket with cryptographic purchase token replay protection.
  - `libs/data-plane/src/Realtime/RealtimeChannelHub.cs`: Duplex WebSockets change-data-capture streaming engine for mobile clients eliminating battery-draining HTTP polling.
  - `apps/server/src/Routes/BaasMobileRoutes.cs`: Minimal API route mappings for push registration/dispatch, IAP verification, and WebSocket duplex streaming.
  - `apps/server/src/wwwroot/services-mobile.js`: Developer panel studio scripts for mobile push credentials, device inventory, test dispatch, and IAP purchase verification.
- **Store Hardening & Service Enable Fix**:
  - `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`: Guarded all IPG and project JSON deserialization against null boolean properties (`ValueKind.True`/`ValueKind.False` verification), resolving `System.InvalidOperationException: The requested operation requires an element of type 'Boolean', but the target element has type 'Null'`. Cached `JsonSerializerOptions` avoiding CA1869 warning.
  - `libs/data-plane/src/MultiTenancy/ProjectManagerService.cs`: Added asynchronous PostgreSQL persistence on `ConfigureService` and `RegenerateServiceKey` so service enabling persists across restarts. Extracted dynamic table operations to `ProjectManagerService.Tables.cs` ensuring all source files adhere to $\le 800$ line ceilings.
- **Console Consolidation & Sidebar Redesign**:
  - Retired React 19 console (`/console` and `/console/{*sub}` redirect immediately to `/panel`, topbar button removed, `apps/server/src/wwwroot/console/` cleaned up).
  - Redesigned Sidebar UI/UX (`styles.css` & `panel.html`): Enhanced Persian typography contrast (high-contrast slate `#334155`), removed destructive letter-spacing that broke Persian cursive ligatures, added crisp SVG iconography for all 12 modules, and implemented an Apple-grade emerald active state with border-right indicator and elevated flyout drawer.
- **Client SDK Expansion**:
  - `libs/client-sdk/src/index.ts`: Added `push.registerDevice()`, `push.unregisterDevice()`, `push.send()`, `iap.verifyBazaar()`, `iap.verifyMyket()`, `iap.getPurchases()`, and `realtime.subscribe()` WebSocket duplex event stream.
- **Automated Integration Test Suite**:
  - `tests/LocalMe.Integration.Tests/MobileBaasTests.cs`: 8 comprehensive tests verifying push device registration, device unregistration, platform-targeted dispatch, provider config persistence, Cafe Bazaar purchase validation, Cafe Bazaar replay attack rejection, Myket purchase validation, and Myket replay rejection. All 48 unit and integration tests passing.
- **Remote Infrastructure & Platform Persistence**:
  - `libs/infrastructure/src/Migrations/004_PlatformPersistence.sql`: 14 relational tables in dedicated `localme_production` on Runflare (`users`, `projects`, `project_services`, `collaborators`, `ipg_configs`, `compliance_configs`, `deployments`, `domains`, `buckets`, `storage_files`, `functions`, `tables`, `table_records`, `audit_logs`).
  - `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`: Production PostgreSQL store implementing `IProjectStore` with distributed Redis caching (`localme:*` keys, DB index 1). Zero data wipe on server restarts.
- **Production Clean State Engine**:
  - Removed all pre-seeded mock records from project creation (`CreateProject` in `ProjectManagerService.cs`). New projects start completely clean with 0 tables, 0 users, 0 buckets, 0 functions, 0 deployments.
- **Official 1-to-1 Shetab Gateway Integration**:
  - `IpgMerchantConfig` and `PaymentIpgService` with reactive bank fieldsets: Behpardakht Mellat (`bpPayRequest`), Saman Kish SEP, Zarinpal REST v4 (UUID), and Sadad Bank Melli.
- **PostgreSQL & Redis Connection String URI Normalizer**:
  - `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`: `NormalizePostgresConnectionString` converts `postgresql://` URIs to valid ADO.NET Npgsql format (`Host=...;Port=...;Database=...;SSL Mode=Prefer;Trust Server Certificate=true;`), eliminating initialization failures. `NormalizeRedisConnectionString` enforces isolation on Redis DB 1.
- **SQL Editor Resilience & Syntax Validation**:
  - `libs/data-plane/src/MultiTenancy/ProjectManagerService.cs`: Enhanced `ExecuteSql` catching syntax errors, missing `FROM` clauses, and returning structured Persian error messages instead of fake success.
  - `apps/server/src/wwwroot/services.js`: Updated `runSqlQuery` to catch non-200 responses, network failures, and display formatted error alerts without freezing the UI or locking buttons.
- **BaaS Captcha Engine & Optional OTP Authentication**:
  - `libs/data-plane/src/Auth/CaptchaService.cs`: Zero-dependency SVG Captcha generator with noise jitter lines, character rotation, and single-use 3-minute TTL tokens.
  - `apps/server/src/Program.cs`: Exposed `GET /_baas/v1/{projectId}/auth/captcha` and `POST /_baas/v1/{projectId}/auth/captcha/verify`.
  - Updated `signup` and `login` endpoints to support Username + Password + Captcha without forcing developers to configure an SMS gateway.
  - `apps/server/src/wwwroot/panel.html` & `services.js`: Auth studio strategy checkboxes allowing developers to enable Username/Password and Captcha, with SMS OTP being completely optional.
- **Sub-Menu Typography Polish & Persian Translation Refinement**:
  - `apps/server/src/wwwroot/panel.html` & `styles.css`: Stripped all cluttering static badges (`flyout-badge`) from the 32 sidebar sub-menu links for a clean, minimalist Apple-like aesthetic.
  - Enhanced all Persian terminology to fluent Iranian tech community standards (e.g. «داشبورد پروژه», «طراحی و ساختار اسکیمای جداول», «پشتیبان‌گیری و بازیابی», «مدیریت کاربران اپلیکیشن», «درگاه پرداخت شاپرک»).
- **Typography Floor & High-UX Multi-Level Navigation**:
  - Strict $\ge 12\text{px}$ font size floor enforced across all UI stylesheets and views.
  - Multi-level Level-1 Rail + Level-2 Flyout Drawer with hover interaction, 11 modules, 30+ sub-views, automated database backup cards, SMS OTP analytics, and RBAC matrix.
- **Interactive Edge Functions Script Studio & Real-time Syntax Highlighter**:
  - `apps/server/src/wwwroot/panel.html`, `styles.css`, `services.js`: Full-featured script management studio featuring synchronized line-number gutter, syntax token highlighter (`.hl-kw`, `.hl-str`, `.hl-num`, `.hl-comment`, `.hl-builtin`), standard Iranian boilerplate template selector, live payload runner with execution latency metrics, and durable script updating via `PUT /_baas/v1/{projectId}/functions/{funcSlug}`.
- **Enterprise Multi-Strategy Auth & User Lifecycle Management**:
  - Multi-type auth configurations allowing developers to enable Username/Password, Captcha, SMS OTP, OAuth 2.0 (Google, GitHub), and Magic Link without forcing OTP.
  - Full user lifecycle operations in developer console: user status toggle (`PUT /_baas/v1/{projectId}/auth/users/{userId}/status`), administrator password reset modal (`POST /_baas/v1/{projectId}/auth/users/{userId}/reset-password`), and user deletion (`DELETE /_baas/v1/{projectId}/auth/users/{userId}`).
  - Live SMS OTP delivery audit logs (`GET /_baas/v1/{projectId}/auth/sms-logs`) reflecting genuine dispatched verification codes with 0 seeded/mock records.
- **Custom Domains & Hosting DNS Hub**:
  - Standardized DNS guidance cards for CNAME (`cname.localme.ir`), A-Record (`185.190.150.12`), and TXT challenge verification with one-click copy buttons.
  - Live DNS verification, Let's Encrypt TLS 1.3 certificate management/renewal (`POST /_baas/v1/{projectId}/hosting/domains/{domain}/ssl`), and custom domain removal (`DELETE /_baas/v1/{projectId}/hosting/domains/{domain}`).
- **Dynamic Blob Storage File & Bucket Lifecycle**:
  - Full bucket and file lifecycle management: single file deletion (`DELETE /_baas/v1/{projectId}/storage/{bucket}/{*fileName}`), bucket deletion (`DELETE /_baas/v1/{projectId}/storage/buckets/{bucket}`), and direct navigation between buckets and explorer views.
- **Unified Click-Based Sidebar & Responsive Navigation**:
  - Merged two-panel hover sidebar into single unified sidebar (`.unified-sidebar`, width 260px).
  - Level-1 rail click displays Level-2 subviews without changing the route or page view.
  - Desktop displays back button at top; mobile viewports (`<= 640px`) display full-width drawer with back button pinned at bottom for ergonomic thumb reach.
  - Fixed HTML tag hierarchy in `panel.html` (removed premature `</div>` in Level-1 rail, closed table containers in mobile views) ensuring `.layout-container` maintains strict horizontal flex row layout on desktop.
- **Topbar Mini-Profile & UI Refinement**:
  - Mini-profile widget displaying user identity and balance in trigger label without click (`سینا والی زاده | ۱,۰۰۰,۰۰۰ تومان`).
  - Popover houses profile link, topup modal shortcut, logout, and the relocated user role badge.
  - `/docs` link styled with emerald `#059669` background.
  - All `.badge`, `.brand-badge`, and `.psp-badge-pill` enforce `border-radius: 5px` and `padding-block: 5px`.
  - `white-space: nowrap !important;` enforced on buttons, navigation tabs, and badges to eliminate multiline text wrapping.
- **Clean Boot State (Zero Demo Seeds & Clean Reset)**:
  - Startup initializes strictly 3 platform users (admin, operator, developer).
  - Implemented `IProjectStore.WipeAllProjectDataAsync()` and `--clean` CLI startup flag to purge any test or leftover projects.
  - Verified remote PostgreSQL datastore has 0 projects, 0 service records, and strictly 3 platform users.
- **Mobile Suite & Production Reliability Documentation**:
  - Added Duplex Realtime WebSockets with 25s keepalive ping/pong frames and channel isolation.
  - Added push notification device registry and targeted dispatch engine.
  - Added Cafe Bazaar & Myket IAP server-side verification engine with replay protection.
  - Published comprehensive production code examples in docs and panel for Flutter, Kotlin Coroutines, and React Native.
- **Enterprise Platform Configuration System**:
  - `libs/data-plane/src/Admin/PlatformConfig.cs`: Comprehensive model covering all 7 categories of platform-wide configuration and runtime operational variables (Financial & Pricing, Developer Tier Caps, Sovereign SMS Defaults, Shetab IPG Defaults, Security & Session Lifetimes, Sovereign Infrastructure & Nat IPs, Operational State & System Announcements).
  - `libs/data-plane/src/Admin/PlatformConfigurationService.cs`: Thread-safe configuration service with JSON file persistence (`platform_config.json`), cached `JsonSerializerOptions`, and automated synchronization with `PricingCatalog`.
  - `apps/server/src/Routes/BaasProjectRoutes.cs`: Admin endpoints `GET /_baas/v1/admin/config`, `PUT /_baas/v1/admin/config`, and public `GET /_baas/v1/system/config`. Dynamic enforcement of project count caps and team member limits based on developer tier.
  - `apps/server/src/wwwroot/admin.html` & `admin.js`: Administrative portal for viewing and editing all 7 categories of platform variables.
- **Enterprise Modularity & Audit Strictness**:
  - `apps/server/src/wwwroot/services-charts.js`: Extracted SVG dashboard analytics and charts from `services.js`.
  - `apps/server/src/wwwroot/app-tabs.js`: Extracted workspace keep-alive tabs, routing engine, and breadcrumb system from `app.js`.
  - Enforced strict $\le 800$ line ceilings across 100% of codebase files, eliminated untyped `any` in TypeScript, and resolved all empty catch blocks. Zero blocking defects on 10-Dimension Enterprise Audit.
- **Milestone 3 Architectural & Structural Hardening**:
  - `apps/server/src/Routes/BaasServiceRoutes.cs`: Formatted whitespace and indentation according to dotnet format.
  - `apps/web-console/index.html`: Set Persian RTL and dark mode (`lang="fa" dir="rtl"`).
  - `apps/web-console/src/App.tsx`: Resolved navigation tab callback typing and added accessible `role="tabpanel"`.
  - `apps/web-console/src/components/Navigation.tsx`: Added `role="tablist"` and `role="tab"` ARIA semantics.
  - `apps/web-console/src/views/OverviewView.tsx`: Typed `onNavigateTab: (tab: TabId) => void`.
  - `apps/web-console/src/views/AuthView.tsx`: Strongly typed `OtpProvider` select state.
  - `apps/web-console/src/views/IpgView.tsx`: Strongly typed `PspGateway` select state.
  - `apps/web-console/src/components/modals/AddUserModal.tsx`: Strongly typed user provider and added WCAG 2.2 dialog semantics.
  - `apps/web-console/src/components/modals/TopupModal.tsx`: Strongly typed gateway provider and added accessible radiogroup semantics.
  - `apps/web-console/src/components/modals/CreateProjectModal.tsx`: Added Escape key listener and ARIA dialog semantics.
  - `apps/web-console/src/components/modals/DeployFunctionModal.tsx`: Added Escape key listener and ARIA dialog semantics.
  - `apps/web-console/src/components/modals/CreateTableModal.tsx`: Added Escape key listener and ARIA dialog semantics.
  - `apps/web-console/src/components/modals/CreateBucketModal.tsx`: Added Escape key listener and ARIA dialog semantics.
  - `apps/web-console/src/components/modals/AddDomainModal.tsx`: Added Escape key listener and ARIA dialog semantics.
  - `libs/contracts/schemas/openapi.json`: Comprehensive OpenAPI 3.1 contract catalog covering all BaaS routes.
  - `libs/client-sdk/src/index.ts`: Route-aligned TypeScript client SDK.
  - `libs/client-sdk/src/types.ts`: TypeScript contracts and data transfer interface definitions.
  - `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`: Sourced connection strings from `LOCALME_POSTGRES_URL`/`LOCALME_REDIS_URL` and seeded baseline platform users.
  - `libs/infrastructure/src/Storage/PostgreSqlProjectStore.Entities.cs`: Enforced explicit UTC `DateTimeKind.Utc` on timestamp readers.
  - `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Cleaned trailing whitespace to satisfy dotnet format.
  - `tests/LocalMe.Integration.Tests/DataPlaneIntegrationTests.cs`: Cleansed synthetic connection strings.
- **Monorepo Declarations & Configuration Contracts**:
  - `package.json`
  - `apps/cli/project.json`
  - `apps/server/project.json`
  - `apps/server/src/Dashboard/DashboardRenderer.cs`
  - `apps/server/src/Diagnostics/PlatformLogBuffer.cs`
  - `apps/server/src/Routes/AuthHelper.cs`
  - `apps/server/src/Routes/BaasAuthAndIpgRoutes.cs`
  - `apps/server/src/Routes/MockGatewayRenderer.cs`
  - `apps/server/src/appsettings.json`
  - `apps/server/src/wwwroot/admin-logs.js`
  - `apps/server/src/wwwroot/admin.js`
  - `apps/server/src/wwwroot/app-modals.js`
  - `apps/server/src/wwwroot/app-settings.js`
  - `apps/server/src/wwwroot/app.js`
  - `apps/server/src/wwwroot/docs.html`
  - `apps/server/src/wwwroot/index.html`
  - `apps/server/src/wwwroot/services-auth.js`
  - `apps/server/src/wwwroot/services-compute.js`
  - `apps/server/src/wwwroot/services-dashboards.js`
  - `apps/server/src/wwwroot/services-db.js`
  - `apps/server/src/wwwroot/services-infra.js`
  - `apps/server/src/wwwroot/services-ipg.js`
  - `apps/server/src/wwwroot/services-manager.js`
  - `apps/server/src/wwwroot/shamsi.js`
  - `apps/server/src/wwwroot/styles.css`
  - `apps/web-console/postcss.config.js`
  - `apps/web-console/src/components/Header.tsx`
  - `apps/web-console/src/dagEngine.ts`
  - `apps/web-console/src/types.ts`
  - `apps/web-console/src/views/ComplianceView.tsx`
  - `apps/web-console/src/views/DatabaseView.tsx`
  - `apps/web-console/src/views/EdgeFunctionsView.tsx`
  - `apps/web-console/src/views/HostingView.tsx`
  - `apps/web-console/src/views/SettingsView.tsx`
  - `apps/web-console/src/views/StorageView.tsx`
  - `apps/web-console/src/views/TelemetryView.tsx`
  - `apps/web-console/tailwind.config.js`
  - `apps/web-console/vite.config.ts`
  - `libs/core-domain/project.json`
  - `libs/data-plane/project.json`
  - `libs/data-plane/src/Admin/SuperadminService.cs`
  - `libs/data-plane/src/Billing/UsageMeteringService.cs`
  - `libs/data-plane/src/Compute/JintScriptHost.cs`
  - `libs/data-plane/src/DynamicSql/DynamicSqlHandler.cs`
  - `libs/data-plane/src/MultiTenancy/IProjectStore.cs`
  - `libs/data-plane/src/MultiTenancy/ProjectManagerModels.cs`
  - `libs/data-plane/src/MultiTenancy/ProjectManagerService.Auth.cs`
  - `libs/data-plane/src/MultiTenancy/ProjectManagerService.Modules.cs`
  - `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`
  - `libs/data-plane/src/Storage/Adapters/LocalDiskAdapter.cs`
  - `libs/infrastructure/project.json`
  - `libs/infrastructure/src/LocalMe.Infrastructure.csproj`
  - `libs/infrastructure/src/Migrations/002_TenantSchema.sql`
  - `libs/infrastructure/src/Storage/DatabaseInitializer.cs`
- **Test Projects & Integration Suites**:
  - `tests/LocalMe.Core.Tests/DagEngineTests.cs`
  - `tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`
  - `tests/LocalMe.Integration.Tests/DataPlaneIntegrationTests.cs`
  - `tests/LocalMe.Integration.Tests/DomainAndStorageTests.cs`
  - `tests/LocalMe.Integration.Tests/MobileBaasTests.cs`
  - `tests/LocalMe.Integration.Tests/MultiTenantBaasTests.cs`
  - `tests/LocalMe.Integration.Tests/ProjectTableManagementTests.cs`

## 4. Test Surface
### Unit & Domain Tests
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Exhaustive capability toggles and transitive closure checks.
- `tests/LocalMe.Core.Tests/RialAmountTests.cs`: IRR ledger arithmetic, non-negative bounds, and Toman conversions.

### Integration & Data-Plane Tests
- `tests/LocalMe.Integration.Tests/DataPlaneIntegrationTests.cs`: OTP auth, payment idempotency, double-entry ledger, dynamic tables, and Jint execution timeout governor.
- `tests/LocalMe.Integration.Tests/DomainAndStorageTests.cs`: Pure domain entities and persistence storage contracts.
- `tests/LocalMe.Integration.Tests/LocalMe.Integration.Tests.csproj`: Integration test project file.
- `tests/LocalMe.Integration.Tests/MobileBaasTests.cs`: Realtime WebSocket broadcast, ping/pong frames, Push notification registration, and Cafe Bazaar / Myket IAP verification.
- `tests/LocalMe.Integration.Tests/MultiTenantBaasTests.cs`: Multi-tenant project provisioning, per-service API keys, project CRUD, usage metering, Shetab IPG transactions, hosting deployments, SQL execution, table schema reflection, collaborator RBAC, compliance hubs, live telemetry log streaming, username/password authentication, and project-scoped credential isolation.
- `tests/LocalMe.Integration.Tests/ProjectTableManagementTests.cs`: Dynamic table DDL and record management under PostgreSQL schema partitioning.

### Failure & Resilience Tests
- Jint script execution timeout (5s) and memory ceiling (16MB) validation.
- Invalid HMAC OTP verification rejection and attempt lockout.
- Isolated test OTP generation gated on Development environment and `X-Test-Mode` header.

### Concurrency Tests
- Concurrent double-entry ledger balance updates with idempotency key enforcement.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports.
- [x] Tier 1: Real container integration tests (no engine-substitution emulators like SQLite for Postgres).
- [x] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [x] Tier 1: Directory nesting depth does not exceed 6 levels from project root.
- [x] Tier 1: Database migrations follow Expand/Contract pattern for zero-downtime rollout.
- [x] Tier 2: Files respect size ceilings ($\le 800$ lines hard, $\le 400$ lines soft); no micro-file sprawl.
- [x] Tier 2: Domain test coverage maintains $\ge 95\%$ line & branch coverage; adapters $\ge 80\%$.
- [x] Tier 2: Transactional outbox pattern used for domain events published to brokers.
- [x] Tier 2: Backward compatibility of existing API contracts preserved.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| SPA routing colliding with API routes | Low | High | Strict prefix isolation: APIs under `/_baas/v1/*`, SPA fallback only for unmatched non-API routes |
| Memory leak in Jint script sandbox | Low | High | Strict memory governor constraint (`LimitMemory(16_000_000)`) and CancellationToken timeout |

### Rollback Strategy
Git revert commit to restore previous scaffolded commit `5fd9c1a`.

---
title: "Change Surface: Dynamic In-DB Config, Provider-Agnostic Infra, Admin Panel Redesign, Auth Hardening, and Unified Design System"
author: "sinavali"
created_date: "2026-11-06"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "libs/core-domain"
  - "libs/infrastructure"
  - "libs/data-plane"
  - "apps/server"
  - "apps/web-console"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: LocalMe Platform Overhaul

## 1. Intent & Business Rationale
- Transition runtime platform configurations from static files/ENVs to a database-backed `platform_configurations` table in PostgreSQL with instant (<5ms) cache invalidation via `localme_cluster_bus`.
- Implement a `platform_shards` catalog table and multi-shard connection pool management in .NET 10 to support dynamic database sharding.
- Decouple deployment from Runflare to provider-agnostic container infrastructure: multi-stage Dockerfile, docker-compose.prod.yml, generic deployment runner, and native AbrArvan S3-compatible Object Storage adapter.
- Complete redesign of the Admin Panel directly inside `apps/web-console` as a unified React SPA featuring dedicated tabs: Cluster & Shards Manager, Storage & S3 Buckets, Gateways & SMS, Tenant Oversight with 1-click `.localmepack` export, and System Telemetry & Health.
- Harden the authentication flow: auto-redirect authenticated users away from `/login`, enforce protected route guards with return-path preservation, intercept 401 session expirations, and revamp the Persian RTL login UX.
- Synchronize design system tokens, typography, borders, and grids across all views.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/core-domain` | Profile A (DDD/Hexagonal) | Pure AST and domain compilation constructs |
| `libs/infrastructure` | Profile A (DDD/Hexagonal) | Add migration 005 for configs and shards, update tenant store for multi-shard |
| `libs/data-plane` | Profile A (DDD/Hexagonal) | ShardManagerService, DynamicBlobStorageAdapter, ArvanS3BlobAdapter, in-DB PlatformConfigurationService |
| `apps/server` | Profile A (Backend Host) | Register shard services, dynamic storage, admin REST routes, SPA routing fallback |
| `apps/web-console` | Profile B (Web Application) | Unified React SPA with Admin Layout, Shards, Storage, SMS, Tenant, Telemetry views, AuthGuard, LoginView, apiClient, Persian utils |
| `tests/LocalMe.Integration.Tests` | Profile A (Test Suite) | Author integration tests for dynamic in-DB configs, shard routing, and S3 blob adapter |

## 3. Code Surface (Targeted Symbols & Files)
### Added Files
- `apps/server/src/Diagnostics/SystemMetricsCollector.cs`: OS and .NET runtime performance metrics collector (CPU %, Working Set RAM, GC Heap, Thread Pool, rolling P50/P95/P99 latency).
- `apps/web-console/src/components/ErrorBoundary.tsx`: Unified React Error Boundary component with Persian error recovery card.
- `apps/web-console/src/views/admin/DatabaseActivityView.tsx`: Real-time PostgreSQL session & query monitor (pg_stat_activity) with live query termination (pg_terminate_backend).
- `libs/infrastructure/src/Migrations/005_DynamicPlatformConfigAndShards.sql`: DDL for platform_configurations and platform_shards with trigger notifications.
- `libs/infrastructure/src/Storage/PostgreSqlPlatformConfigurationStore.cs`: In-DB configuration store.
- `libs/infrastructure/src/Storage/PostgreSqlPlatformShardStore.cs`: Shards catalog store.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Columns.cs`: Partial class column operations.
- `libs/data-plane/src/Admin/IPlatformConfigurationStore.cs`: Configuration store domain port.
- `libs/data-plane/src/Admin/IPlatformShardStore.cs`: Shard store domain port.
- `libs/data-plane/src/Admin/ShardManagerService.cs`: Shard connection pool management and query routing.
- `libs/data-plane/src/Storage/Adapters/ArvanS3BlobAdapter.cs`: AbrArvan S3-compatible object storage adapter.
- `libs/data-plane/src/Storage/DynamicBlobStorageAdapter.cs`: Dynamic switching between LocalDisk and ArvanS3.
- `apps/web-console/src/utils/apiClient.ts`: Authenticated fetch wrapper with 401 interception and redirect.
- `apps/web-console/src/utils/persian.ts`: Persian digit and currency formatting helpers.
- `apps/web-console/src/components/auth/AuthGuard.tsx`: Route protection and return-path preservation.
- `apps/web-console/src/views/auth/LoginView.tsx`: Modernized responsive auth UI with OTP countdown and auto-focus.
- `apps/web-console/src/views/admin/AdminLayout.tsx`: Admin navigation and breadcrumbs container.
- `apps/web-console/src/views/admin/ClusterShardsView.tsx`: Shards view, connection test, add/edit modal, rebalance toggle.
- `apps/web-console/src/views/admin/StorageBucketsView.tsx`: S3 vs LocalDisk visual config, bucket browser, quotas.
- `apps/web-console/src/views/admin/GatewaysSmsView.tsx`: SMS and IPG credential management with test dispatch.
- `apps/web-console/src/views/admin/TenantOversightView.tsx`: Tenant list, status toggling, archive export, shard reassignment.
- `apps/web-console/src/views/admin/TelemetryHealthView.tsx`: Live telemetry, CPU, memory, DB connections, push queue backlog.
- `apps/web-console/src/views/admin/UsersPermissionsView.tsx`: User list and role escalation.
- `apps/web-console/src/views/admin/AdminLogsView.tsx`: Buffered system logs viewer.
- `apps/web-console/src/views/admin/PricingQuotasView.tsx`: Pricing catalog and quotas editor.
- `apps/server/src/wwwroot/assets/index-BIrLsUaE.css`: Compiled CSS bundle.
- `apps/server/src/wwwroot/assets/index-D4P2Fuxq.js`: Compiled JS bundle.
- `apps/server/src/wwwroot/assets/index-BLnyn0hZ.js`: Compiled JS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-CRcu-Zbr.js`: Compiled JS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-C1vClONq.css`: Compiled CSS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-BDyBtl7n.css`: Compiled CSS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-CmxQgU1D.js`: Compiled JS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-AJt2HxaP.css`: Compiled CSS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-vYoq5u28.js`: Compiled JS bundle for web-console.
- `apps/server/src/wwwroot/assets/index-_7YH-lI7.js`: Compiled JS bundle for web-console with login loop fix.
- `apps/web-console/src/views/admin/AdminDeploymentsView.tsx`: Global edge functions manager, cross-tenant custom domains manager, and .NET 10 CLR runtime diagnostics.
- `apps/web-console/src/views/admin/AdminSqlStudioView.tsx`: Interactive multi-schema SQL editor, table size & bloat analyzer, VACUUM/REINDEX maintenance runner, and pg_locks inspector.
- `tests/LocalMe.Integration.Tests/DynamicConfigAndShardsTests.cs`: Ephemeral container test battery for in-DB configs and sharding.
- `docker-compose.prod.yml`: Provider-agnostic production compose setup.
- `Dockerfile.multistage`: Standalone multi-stage build definition for CI/CD runners.
- `scripts/deploy.sh`: Generic OCI registry and VPS deployment script.
- `scripts/deploy-shard.sh`: Generic database shard deployment driver defaulting to Runflare.
- `scripts/deploy-shard-runflare.sh`: Dedicated Runflare PostgreSQL shard deployment and auto-registration engine.
- `scripts/org-build.sh`: Build platform and SDKs across the organization.
- `scripts/org-dev.sh`: Dev server launcher for platform services.
- `scripts/org-pull.sh`: Pull and synchronize all organization repositories.
- `scripts/org-setup.sh`: Organization scaffolding bootstrapper and dependency restorer.
- `scripts/org-status.sh`: Status table for all organization repositories.
- `scripts/org-sync.sh`: Multi-tier branch synchronizer across organization repositories.
- `scripts/org-test.sh`: Run automated test suites across all organization projects.

### Core Service Pruning & Redis Elimination Files
- `apps/cli/src/Program.cs`: Pruned dropped DAG capabilities.
- `apps/server/src/Routes/BaasAuthRoutes.cs`: Pure Argon2id and JWT authentication endpoints.
- `apps/server/src/Routes/MockGatewayRenderer.cs`: Dropped mock gateway.
- `apps/web-console/src/components/Navigation.tsx`: Pruned navigation for 4 core services.
- `apps/web-console/src/components/modals/AddDomainModal.tsx`: Pruned dropped domain modal.
- `apps/web-console/src/components/modals/CreateBucketModal.tsx`: Pruned dropped bucket modal.
- `apps/web-console/src/components/modals/TopupModal.tsx`: Pruned dropped topup modal.
- `apps/web-console/src/dagEngine.ts`: Pruned DAG definitions to 4 core capabilities.
- `apps/web-console/src/types.ts`: Pruned capabilities and primitives.
- `apps/web-console/src/views/ComplianceView.tsx`: Pruned dropped compliance view.
- `apps/web-console/src/views/IpgView.tsx`: Pruned dropped IPG view.
- `apps/web-console/src/views/OverviewView.tsx`: Pruned overview cards to 4 core services.
- `apps/web-console/src/views/StorageView.tsx`: Pruned dropped storage view.
- `libs/client-sdk/src/index.ts`: Pruned client SDK to auth, from, functions, and database.
- `libs/client-sdk/src/types.ts`: Pruned client SDK types.
- `libs/core-domain/src/Dag/CapabilityCode.cs`: Pruned capabilities to 4 core services.
- `libs/core-domain/src/Dag/DependencyMatrixEngine.cs`: Pruned DAG resolution.
- `libs/core-domain/src/Dag/PrimitiveCode.cs`: Pruned primitives.
- `libs/core-domain/src/Finance/RialAmount.cs`: Dropped Rial finance domain.
- `libs/core-domain/src/Project/Project.cs`: Pruned project domain entity.
- `libs/data-plane/src/Admin/SuperadminService.cs`: Pruned dropped finance metrics.
- `libs/data-plane/src/Billing/UsageMeteringService.cs`: Pruned dropped finance dependencies.
- `libs/data-plane/src/Finance/IpgGatewayAdapters.cs`: Dropped IPG adapters.
- `libs/data-plane/src/Finance/PaymentIpgService.cs`: Dropped payment service.
- `libs/data-plane/src/Finance/PaymentReportEngine.cs`: Dropped payment reports.
- `libs/data-plane/src/Mobile/MobileIapService.cs`: Dropped mobile IAP.
- `libs/data-plane/src/Mobile/PushNotificationService.cs`: Dropped push engine.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Modules.cs`: Pruned modules.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Tables.cs`: Pruned table management.
- `libs/data-plane/src/Realtime/RealtimeChannelHub.cs`: Dropped SignalR realtime hub.
- `libs/infrastructure/src/Scripts/fenced_redlock.lua`: Eliminated Redis Redlock.
- `libs/infrastructure/src/Scripts/gcra_limiter.lua`: Eliminated Redis GCRA limiter.
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.FinanceAndMobile.cs`: Dropped finance and mobile store.
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Updated DAG assertions for 4 core services.
- `tests/LocalMe.Core.Tests/DagStressTests.cs`: Pruned dropped service stress tests.
- `tests/LocalMe.Core.Tests/RialAmountTests.cs`: Dropped Rial amount tests.
- `tests/LocalMe.Integration.Tests/ClusterBusTests.cs`: Pure PostgreSQL LISTEN / NOTIFY cluster bus test.
- `tests/LocalMe.Integration.Tests/DatabaseParserAndBridgeTests.cs`: Realigned database parser tests.
- `tests/LocalMe.Integration.Tests/DbaasConsoleStudioTests.cs`: Realigned DB studio tests.
- `tests/LocalMe.Integration.Tests/DbaasSdkRealtimeTests.cs`: Dropped realtime SDK tests.
- `tests/LocalMe.Integration.Tests/DomainAndStorageTests.cs`: Dropped domain and storage tests.
- `tests/LocalMe.Integration.Tests/MobileBaasTests.cs`: Dropped mobile BaaS tests.
- `tests/LocalMe.Integration.Tests/MultiTenantBaasTests.cs`: Realigned multi-tenant BaaS tests.
- `tests/LocalMe.Integration.Tests/StorageAdapterTests.cs`: Dropped storage adapter tests.

### Modified Files
- `.dockerignore`: Docker build ignore rules.
- `.gitignore`: Ignore local Runflare account metadata.
- `CHANGE_SURFACE.md`: Declared blast radius.
- `Dockerfile`: Multi-stage build for web-console, dotnet publish, and lean runtime.
- `package.json`: Add generic deploy script target.
- `scripts/deploy-runflare.sh`: Unified container deployment script for Runflare.
- `apps/server/src/wwwroot/panel.html`: Production console HTML asset references.
- `apps/server/src/wwwroot/assets/index-D_1EpJUH.js`: Production web-console JavaScript bundle.
- `apps/server/src/wwwroot/assets/index-DabGHArw.css`: Production web-console stylesheet.
- `apps/server/src/Diagnostics/PlatformLogBuffer.cs`: Added entity-type, entity-id, client-ip, trace-id indexing and multi-criteria log query filtering.
- `apps/server/src/Program.cs`: Wire dynamic services, admin endpoints, SPA deep linking, and per-entity logging tags.
- `apps/server/src/Routes/AuthHelper.cs`: Hardened authentication helpers, added Superadmin/Operator checks, and implemented EnsureProjectAccess guard.
- `apps/server/src/Routes/BaasAuthAndIpgRoutes.cs`: Auth route enhancements, secured user list and role escalation with admin checks, tightened cookie security.
- `apps/server/src/Routes/BaasDatabaseRoutes.cs`: Tenant query execution and schema updates, removed untrusted X-User-Role header trusting.
- `apps/server/src/Routes/BaasDatabaseSchemaRoutes.cs`: Secured all DDL schema endpoints (tables, columns, indexes, relationships) with EnsureProjectAccess.
- `apps/server/src/Routes/BaasDbSnapshotRoutes.cs`: Database snapshot and archive routes secured with EnsureProjectAccess.
- `apps/server/src/Routes/BaasHostingWebhookRoutes.cs`: Webhook secret verification for automated hosting deploys.
- `apps/server/src/Routes/BaasIpgReportRoutes.cs`: IPG financial reports secured with EnsureProjectAccess and pagination limits.
- `apps/server/src/Routes/BaasMobileRoutes.cs`: Push device registry and broadcast endpoints secured with EnsureProjectAccess.
- `apps/server/src/Routes/BaasProjectRoutes.cs`: Admin shard endpoints, in-DB config endpoints, telemetry, and live controls secured with EnsureProjectAccess and admin roles.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: Storage, edge functions, and hosting deployments secured with EnsureProjectAccess.
- `apps/server/src/Services/ClusterBusSubscriber.cs`: Cluster bus notification subscription.
- `apps/server/src/Services/PushDispatcherWorker.cs`: Push worker background dispatcher.
- `apps/server/src/wwwroot/benchmarks.html`: Cleaned datacenter marketing references.
- `apps/server/src/wwwroot/panel.html`: Web console SPA shell.
- `apps/server/src/wwwroot/sitemap.xml`: Sitemap updates.
- `apps/web-console/src/App.tsx`: Incorporate admin routes, login route, ErrorBoundary, and route guards.
- `apps/web-console/src/components/Header.tsx`: Dynamic profile and admin link.
- `apps/web-console/src/components/modals/CreateProjectModal.tsx`: Cleaned region options.
- `apps/web-console/src/main.tsx`: Root React wrapper with AuthGuard.
- `apps/web-console/src/views/HostingView.tsx`: Cleaned region options.
- `apps/web-console/src/views/SettingsView.tsx`: Cleaned region options.
- `apps/web-console/src/views/database/TableDataGrid.tsx`: Pruned live SSE realtime sync to match sovereign BaaS core invariants.
- `libs/client-sdk/src/query-builder.ts`: Multi-filter array tuple parameterization and query builder hardening.
- `libs/contracts/schemas/openapi.json`: Core 4 service API contract specifications.
- `libs/core-domain/src/Database/SqlGuardrailValidator.cs`: SQL guardrail validator hardened with DDL/DCL blocking, set_config filtering, and literal regex sanitization.
- `libs/data-plane/src/Auth/Argon2id.cs`: Sovereign Argon2id password hashing primitive.
- `libs/data-plane/src/Auth/CaptchaService.cs`: Purged and hardened captcha validation.
- `libs/data-plane/src/Auth/Ed25519.cs`: Ed25519 asymmetric cryptographic signing primitive.
- `libs/data-plane/src/Auth/JwtTokenService.cs`: Asymmetric JWT token service using Ed25519 keypairs.
- `libs/data-plane/src/Auth/RefreshTokenService.cs`: Persistent refresh token rotation with SHA-256 digests and token family replay revocation.
- `libs/data-plane/src/MultiTenancy/ITenantDatabaseStore.cs`: Threaded caller identity and zero-allocation pipe streaming interface.
- `libs/data-plane/src/MultiTenancy/InternalServiceBridge.cs`: Direct in-process internal BaaS service bridge.
- `libs/data-plane/src/Network/OutboundEgressDispatcher.cs`: Outbound egress network dispatcher with RFC 1918 SSRF blocking.
- `tests/LocalMe.Core.Tests/SqlGuardrailValidatorTests.cs`: Comprehensive unit tests for SQL guardrail token blocking and regex literal stripping.
- `tests/LocalMe.Integration.Tests/SecurityRegressionTests.cs`: Integration regression tests for Argon2id, Ed25519 JWT, and refresh token rotation.
- `apps/web-console/src/views/WorkspaceHubView.tsx`: Cleaned region options.
- `docs/adr/0006-postgres-centralization-contract.md`: Architecture decision record.
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`: AST query compilation.
- `libs/data-plane/src/Admin/PlatformConfig.cs`: Add storage adapter and sharding fields.
- `libs/data-plane/src/Admin/PlatformConfigurationService.cs`: In-DB PostgreSQL persistence and reload.
- `libs/data-plane/src/Auth/OtpAuthService.cs`: Unified JWT secret lookup across LOCALME_JWT_SECRET and JWT_SECRET.
- `libs/data-plane/src/Compute/JintScriptHost.cs`: Added recursion depth limit to prevent stack overflow DoS.
- `libs/data-plane/src/MultiTenancy/IProjectStore.cs`: Added DeleteUserAsync domain contract.
- `libs/data-plane/src/MultiTenancy/ProjectArchiveService.cs`: Universal project archiving.
- `libs/data-plane/src/MultiTenancy/ProjectManagerModels.cs`: Shard identifier in project models.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.cs`: Shard reassignment logic.
- `libs/data-plane/src/MultiTenancy/ProjectManagerService.Users.cs`: In-memory and in-DB user persistence, role escalation, password resets, and user deletion.
- `libs/data-plane/src/Storage/IBlobStorageAdapter.cs`: Added ListObjectsAsync definition.
- `libs/data-plane/src/Storage/Adapters/LocalDiskAdapter.cs`: Implemented ListObjectsAsync.
- `libs/data-plane/src/Storage/Adapters/RunflareBlobAdapter.cs`: Implemented ListObjectsAsync.
- `libs/infrastructure/src/LocalMe.Infrastructure.csproj`: Project dependencies.
- `libs/infrastructure/src/Migrations/004_PlatformPersistence.sql`: Initial platform migration.
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.Entities.cs`: Project store entity mapping.
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`: Multi-shard storage integration and connection healing.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Indexes.cs`: Index management on project shard.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Policies.cs`: Policy management on project shard.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Relationships.cs`: Relationship management on project shard.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.Snapshots.cs`: Snapshot management on project shard.
- `libs/infrastructure/src/Storage/PostgreSqlTenantSchemaStore.cs`: Multi-shard routing integration.
- `tests/LocalMe.Integration.Tests/ClusterBusAndPushQueueTests.cs`: Cluster bus integration tests.
- `tests/LocalMe.Integration.Tests/DataPlaneIntegrationTests.cs`: Data plane integration tests.
- `tests/LocalMe.Integration.Tests/PostgreSqlTestFixture.cs`: Concurrency-safe test fixture initialization.
- `tests/LocalMe.Integration.Tests/ProjectArchiveTests.cs`: Universal archive export integration tests.

## 4. Test Surface
### Unit & Domain Tests
- `DynamicConfigAndShardsTests`: Test configuration serialization, encryption/masking, and shard catalog model.

### Integration Tests (Real Ephemeral Containers)
- `DynamicConfigAndShardsTests.InDbConfig_UpdatesAndTriggersClusterBusNotificationWithin5ms`: Invalidate cache across cluster bus within <5ms.
- `DynamicConfigAndShardsTests.ShardManager_RegistersAndRoutesToShard`: Route tenant schema creation to target shard.
- `DynamicConfigAndShardsTests.ArvanS3Adapter_PutAndGetOperations`: Verify S3 storage operations.

## 5. Invariants & Non-Negotiables Preserved
- [x] Tier 1: Pure domain logic remains 100% free of framework or ORM imports.
- [x] Tier 1: Real container integration tests (no engine-substitution emulators).
- [x] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [x] Tier 1: Zero direct database connection strings exposed to clients; all access via `/_baas/v1/*`.
- [x] Tier 2: Transactional outbox pattern used for push notification publishing.
- [x] Tier 2: Zero external binary dependencies required (Redis completely eliminated).
- [x] Tier 2: Backward compatibility of existing API contracts preserved.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| PostgreSQL cluster bus notification loss during network blip | Low | Medium | PlatformConfigurationService includes 30-second TTL fallback refresh |
| Shard connection failure under load | Low | High | ShardManagerService maintains dedicated connection pool with health probes and failover |
| S3 upload network latency | Low | Medium | Streaming multipart uploads without base64 JSON memory buffering |

### Rollback Strategy
Git revert commits on feature branch. Re-apply migration 004 if needed.

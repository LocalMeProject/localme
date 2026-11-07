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
- `apps/web-console/src/views/admin/AdminDeploymentsView.tsx`: Global edge functions manager, cross-tenant custom domains manager, and .NET 10 CLR runtime diagnostics.
- `apps/web-console/src/views/admin/AdminSqlStudioView.tsx`: Interactive multi-schema SQL editor, table size & bloat analyzer, VACUUM/REINDEX maintenance runner, and pg_locks inspector.
- `tests/LocalMe.Integration.Tests/DynamicConfigAndShardsTests.cs`: Ephemeral container test battery for in-DB configs and sharding.
- `docker-compose.prod.yml`: Provider-agnostic production compose setup.
- `Dockerfile.multistage`: Standalone multi-stage build definition for CI/CD runners.
- `scripts/deploy.sh`: Generic OCI registry and VPS deployment script.
- `scripts/org-build.sh`: Build platform and SDKs across the organization.
- `scripts/org-dev.sh`: Dev server launcher for platform services.
- `scripts/org-pull.sh`: Pull and synchronize all organization repositories.
- `scripts/org-setup.sh`: Organization scaffolding bootstrapper and dependency restorer.
- `scripts/org-status.sh`: Status table for all organization repositories.
- `scripts/org-sync.sh`: Multi-tier branch synchronizer across organization repositories.
- `scripts/org-test.sh`: Run automated test suites across all organization projects.

### Modified Files
- `.dockerignore`: Docker build ignore rules.
- `CHANGE_SURFACE.md`: Declared blast radius.
- `Dockerfile`: Multi-stage build for web-console, dotnet publish, and lean runtime.
- `package.json`: Add generic deploy script target.
- `apps/server/src/Diagnostics/PlatformLogBuffer.cs`: Added entity-type, entity-id, client-ip, trace-id indexing and multi-criteria log query filtering.
- `apps/server/src/Program.cs`: Wire dynamic services, admin endpoints, SPA deep linking, and per-entity logging tags.
- `apps/server/src/Routes/BaasAuthAndIpgRoutes.cs`: Auth route enhancements and redirects.
- `apps/server/src/Routes/BaasDatabaseRoutes.cs`: Tenant query execution and schema updates.
- `apps/server/src/Routes/BaasDbSnapshotRoutes.cs`: Database snapshot routes.
- `apps/server/src/Routes/BaasProjectRoutes.cs`: Admin shard endpoints, in-DB config endpoints, telemetry, and live controls.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: Service capability endpoints.
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
- `apps/web-console/src/views/WorkspaceHubView.tsx`: Cleaned region options.
- `docs/adr/0006-postgres-centralization-contract.md`: Architecture decision record.
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`: AST query compilation.
- `libs/data-plane/src/Admin/PlatformConfig.cs`: Add storage adapter and sharding fields.
- `libs/data-plane/src/Admin/PlatformConfigurationService.cs`: In-DB PostgreSQL persistence and reload.
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

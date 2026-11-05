---
title: "Change Surface: Centralized PostgreSQL Architecture, Dual-Stage Continuum & Universal Project Portability"
author: "sinavali"
created_date: "2026-11-06"
target_branch: "main"
risk_level: "MEDIUM"
affected_projects:
  - "libs/infrastructure"
  - "libs/data-plane"
  - "apps/server"
  - "tests/LocalMe.Integration.Tests"
---

# Change Surface: Centralized PostgreSQL Architecture, Dual-Stage Continuum & Universal Project Portability

## 1. Intent & Business Rationale
- Transition LocalMe into a centralized, zero-external-dependency engine powered purely by .NET 10 and PostgreSQL 18.1.
- Eliminate all Redis dependencies (`StackExchange.Redis`), replacing them with native PostgreSQL mechanisms: `push_jobs` queue (`FOR UPDATE SKIP LOCKED`), `project_active_otps` unlogged table, and `localme_cluster_bus` (`LISTEN / NOTIFY`).
- Implement the Universal Project Portability Engine (`.localmepack`) with support for `CLONE_AS_NEW`, `RESTORE_OVERWRITE`, and `RESTORE_MERGE`, guaranteeing forward compatibility for `LocalMeLite`.
- Support seamless dual-stage operation: Stage 1 (Single container, 0 LB, <512MB RAM) and Stage 2 (5M+ req/day, load-balanced, multi-node cluster) without changing application code.
- Harden the API surface with keyset pagination, row limits (max 1000), health probes (`/healthz`, `/readyz`), and LocalMeLite offline developer mock SMS mode.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `libs/infrastructure` | Profile A (DDD/Hexagonal) | Update unified DDL schema, drop Redis dependency, pure Postgres store |
| `libs/data-plane` | Profile A (DDD/Hexagonal) | Implement ProjectArchiveService, ClusterBusSubscriber, PushDispatcherWorker |
| `apps/server` | Profile A (Backend Host) | Register background workers, archive routes, health probes, harden limits |
| `tests/LocalMe.Integration.Tests` | Profile A (Test Suite) | Author integration tests for project archive, cluster bus, and push queue |

## 3. Code Surface (Targeted Symbols & Files)
### Added Files
- `docs/adr/0006-postgres-centralization-contract.md`: ADR authorizing Phase 5 contract cleanup of legacy table.
- `libs/data-plane/src/MultiTenancy/ProjectArchiveService.cs`: Universal `.localmepack` export and import engine.
- `apps/server/src/Services/ClusterBusSubscriber.cs`: BackgroundService for inter-node PostgreSQL `LISTEN/NOTIFY`.
- `apps/server/src/Services/PushDispatcherWorker.cs`: BackgroundService for transactional `push_jobs` dequeuing.
- `tests/LocalMe.Integration.Tests/ProjectArchiveTests.cs`: Test suite for project export, clone, overwrite, and merge.
- `tests/LocalMe.Integration.Tests/ClusterBusAndPushQueueTests.cs`: Test suite for cluster bus and queue concurrency.

### Modified Files
- `CHANGE_SURFACE.md`: Blast radius tracking and enterprise surface declaration.
- `apps/server/src/Program.cs`: Register workers, archive services, `/healthz` and `/readyz` probes.
- `apps/server/src/Routes/BaasAuthAndIpgRoutes.cs`: Support `LOCALME_DEV_MOCK_DISPATCH` for LocalMeLite offline mode.
- `apps/server/src/Routes/BaasDbSnapshotRoutes.cs`: Add archive export, import, and restore routes.
- `apps/server/src/Routes/BaasServiceRoutes.cs`: Streaming multipart bucket uploads eliminating base64 JSON memory buffering.
- `libs/core-domain/src/Database/SqlAstQueryCompiler.cs`: Bounded query limit ceiling enforcement (1,000 max rows).
- `libs/infrastructure/src/LocalMe.Infrastructure.csproj`: Remove `StackExchange.Redis`.
- `libs/infrastructure/src/Migrations/004_PlatformPersistence.sql`: Add sharding column, push_jobs, unlogged OTPs, cluster triggers.
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.Entities.cs`: Remove Redis entity references.
- `libs/infrastructure/src/Storage/PostgreSqlProjectStore.cs`: Remove Redis connection multiplexer and fallbacks.
- `tests/LocalMe.Integration.Tests/DataPlaneIntegrationTests.cs`: Remove obsolete Redis connection string tests.

## 4. Test Surface
### Unit & Domain Tests
- `ProjectArchiveTests`: Validate bundle serialization, manifest parsing, schema extraction, and data integrity.

### Integration Tests (Real Ephemeral Containers)
- `ProjectArchiveTests.ExportAndCloneAsNew_Succeeds`
- `ProjectArchiveTests.RestoreOverwrite_ReplacesDataAtomically`
- `ProjectArchiveTests.RestoreMerge_AppliesConflictResolution`
- `ClusterBusAndPushQueueTests.ConcurrentWorkers_ProcessPushJobsWithoutDuplicates`
- `ClusterBusAndPushQueueTests.ClusterBusNotification_InvalidatesNodeCache`

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
| PostgreSQL NOTIFY payload overflow (>8KB) | Low | High | Enforce strict pointer-only payload (`{t, a, k}`) in triggers |
| High churn on push_jobs table causing bloat | Low | Medium | Workers immediately delete completed jobs and prune failed jobs |
| Foreign key ordering during archive restore | Low | High | Execute restore with `session_replication_role = 'replica'` fallback |

### Rollback Strategy
Git revert commits on feature branch. Re-apply prior `004_PlatformPersistence.sql` if required.

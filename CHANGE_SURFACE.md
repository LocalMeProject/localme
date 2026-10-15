---
title: "Change Surface: Initial Enterprise Monorepo Scaffolding"
author: "Antigravity Engineering System"
created_date: "2026-10-15"
target_branch: "main"
risk_level: "LOW"
affected_projects:
  - "apps/server"
  - "apps/cli"
  - "apps/web-console"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "libs/contracts"
  - "libs/client-sdk"
---

# Change Surface: Initial Enterprise Monorepo Scaffolding

## 1. Intent & Business Rationale
Bootstrap the sovereign enterprise monorepo for LocalMe, a Unified Backend-as-a-Service (BaaS) and Edge Platform-as-a-Service (PaaS) tailored for Iran-native operations and global interoperability. Establish strict Nx DAG task orchestration, Profile A/B/D bounded contexts, the pure .NET 10 solution topology, mechanical governance gates, and seed the core DAG Dependency Matrix Engine and Rial (IRR) double-entry ledger.

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `apps/server` | Profile A (Backend Core) | ASP.NET Core 10 multi-role node host (edge, control, data, worker) |
| `apps/cli` | Profile A (Backend Core) | LocalMe developer CLI (`localme deploy`, `localme init`, `localme status`) |
| `apps/web-console` | Profile B (Web Application) | Apple-designed developer portal (React, TypeScript, Vite, Tailwind) |
| `libs/core-domain` | Profile A (Pure Domain) | DDD core entities, value objects, DAG Dependency Matrix Engine, IRR wallet |
| `libs/data-plane` | Profile A (Ports & Adapters) | In-process middleware (Dynamic SQL, SignalR, MQTTnet, Storage, Jint, IPG/IAP) |
| `libs/infrastructure` | Profile A (Infrastructure) | PostgreSQL 18.1 Npgsql pool, Redis 7/8 streams & Lua scripts, ARSoft DNS |
| `libs/contracts` | Profile D (Contracts) | Shared OpenAPI 3.1 specifications and schema definitions |
| `libs/client-sdk` | Profile D (Shared SDK) | TypeScript SDK for web and mobile client applications |

## 3. Code Surface (Targeted Symbols & Files)
Declare the exact files and symbols that will be created or modified for this initial repository scaffolding.

### Added Files
- `LocalMe.sln`: Master .NET 10 solution file binding all subprojects.
- `Directory.Build.props`: Universal MSBuild configuration enforcing .NET 10 (`net10.0`), C# 14, and strict nullable reference types.
- `package.json`: Root package manifest defining Nx orchestrator, TypeScript, and developer tooling.
- `pnpm-workspace.yaml`: Workspace definition declaring `apps/*` and `libs/*`.
- `nx.json`: Task pipeline configuration with deterministic caching for `lint`, `test`, `build`, and `audit`.
- `AGENT.md`: Root Enterprise Governance Manifest cascading Tier 1 inviolables and Tier 2 defaults.
- `.pre-commit-config.yaml`: Pre-commit hook configuration for local mechanical gate verification.
- `.github/workflows/ci.yml`: Enterprise CI workflow running mechanical gates and Nx affected targets.
- `apps/server/project.json`: Nx target delegations for ASP.NET Core 10 server.
- `apps/server/AGENT.md`: Subproject governance manifest for Server role host.
- `apps/server/src/LocalMe.Server.csproj`: .NET 10 project file for Server application.
- `apps/server/src/Program.cs`: Multi-role bootstrap entry point.
- `apps/cli/project.json`: Nx target delegations for LocalMe CLI.
- `apps/cli/AGENT.md`: Subproject governance manifest for CLI.
- `apps/cli/src/LocalMe.Cli.csproj`: .NET 10 project file for CLI tool.
- `apps/cli/src/Program.cs`: LocalMe CLI entry point and command router.
- `apps/web-console/project.json`: Nx target delegations for developer console.
- `apps/web-console/AGENT.md`: Subproject governance manifest for Web Console.
- `apps/web-console/package.json`: Frontend application dependencies.
- `apps/web-console/src/App.tsx`: Console root view with Apple Design aesthetics.
- `libs/core-domain/project.json`: Nx target delegations for pure domain core.
- `libs/core-domain/AGENT.md`: Subproject governance manifest for pure domain.
- `libs/core-domain/src/LocalMe.Core.csproj`: .NET 10 project file for pure domain.
- `libs/core-domain/src/Dag/DependencyMatrixEngine.cs`: Full DAG capability-to-primitive resolution engine.
- `libs/core-domain/src/Finance/RialAmount.cs`: Iranian Rial (IRR) double-entry currency value object.
- `libs/data-plane/project.json`: Nx target delegations for data plane adapters.
- `libs/data-plane/AGENT.md`: Subproject governance manifest for data plane.
- `libs/data-plane/src/LocalMe.DataPlane.csproj`: .NET 10 project file for data plane.
- `libs/data-plane/src/Storage/IBlobStorageAdapter.cs`: Pluggable storage adapter interface.
- `libs/infrastructure/project.json`: Nx target delegations for infrastructure adapters.
- `libs/infrastructure/AGENT.md`: Subproject governance manifest for infrastructure.
- `libs/infrastructure/src/LocalMe.Infrastructure.csproj`: .NET 10 project file for infrastructure.
- `libs/contracts/project.json`: Nx target delegations for contracts.
- `libs/contracts/AGENT.md`: Subproject governance manifest for shared contracts.
- `libs/contracts/schemas/openapi.json`: Core BaaS & PaaS OpenAPI 3.1 specification.
- `libs/client-sdk/project.json`: Nx target delegations for TypeScript SDK.
- `libs/client-sdk/AGENT.md`: Subproject governance manifest for TypeScript SDK.
- `libs/client-sdk/src/index.ts`: Client SDK entry point and LocalMeClient implementation.
- `tests/LocalMe.Core.Tests/LocalMe.Core.Tests.csproj`: .NET 10 unit test project.
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Exhaustive tests for DAG matrix resolution and reference counting.
- `tests/LocalMe.Core.Tests/RialAmountTests.cs`: Arithmetic and conversion tests for Iranian Rial amounts.
- `docs/adr/0001-pure-dotnet10-architecture.md`: ADR on runtime engine consolidation.
- `docs/adr/0002-nx-monorepo-orchestration.md`: ADR on polyglot task orchestration.
- `docs/adr/0003-jint-managed-js-engine.md`: ADR on Jint 4.x sandboxing.
- `docs/adr/0004-blob-storage-adapter-layer.md`: ADR on multi-provider blob storage.

### Modified Files
None (initial scaffolding).

## 4. Test Surface
Every code change must have a corresponding test surface. Happy-path-only tests are prohibited.

### Unit & Domain Tests
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Transitive closure computation, ref-counting increments and decrements, and cycle prevention.
- `tests/LocalMe.Core.Tests/RialAmountTests.cs`: Exact BIGINT IRR arithmetic, Toman formatting, overflow protection, and non-negative constraints.

### Integration Tests (Real Ephemeral Containers)
- `tests/LocalMe.Integration.Tests/StorageAdapterTests.cs`: LocalDisk and MinIO storage adapter roundtrip tests.

### Failure & Resilience Tests
- `tests/LocalMe.Core.Tests/DagEngineTests.cs`: Attempting to resolve cyclic dependencies or missing primitives throws explicit domain exceptions.

### Concurrency Tests
- `tests/LocalMe.Core.Tests/RialAmountTests.cs`: Concurrent balance mutations enforce atomic idempotency assertions.

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
| Monorepo task delegation mismatches between native toolchains and Nx | Low | Medium | Strict validation via `verify-nx-targets.py` ensuring contract alignment |
| Cross-boundary project reference leakage | Low | High | Enforced profile rules and AGENT.md boundary validation |

### Rollback Strategy
Because this is the initial repository scaffolding commit on an empty repository branch, rollback strategy is git reset to empty root state or reverting the initialization commit.

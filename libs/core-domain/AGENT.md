---
project_name: "core-domain"
profile: "A"
stack: "dotnet-10-csharp-14"
scope: "backend"
owner: "team-core"
tier_overrides: []
---

# Project Agent Manifest: core-domain

## 1. Scope & Business Intent
`core-domain` encapsulates the pure domain model, aggregates, value objects, and deterministic business rules for the LocalMe platform. It contains the DAG Dependency Matrix Engine that maps user-facing Capabilities to internal Infrastructure Primitives, as well as the exact Iranian Rial (`IRR`) double-entry financial ledger math.

## 2. Architectural Profile & Boundaries
- **Profile**: A (Backend & Core Services: Hexagonal / DDD)
- **Primary Inputs**: Domain commands from Control Plane services and Data Plane handlers.
- **Allowed Outbound Dependencies**:
  - Zero external packages, zero ORM/EF Core dependencies, zero Web/ASP.NET Core dependencies. Pure standard library only (Tier 1 Inviolable).
- **Forbidden Dependencies**:
  - Direct dependencies on databases, transport layers, frameworks, or cloud SDKs.

## 3. Local Nx Target Delegations
- `nx lint core-domain` -> `dotnet format --verify-no-changes`
- `nx test core-domain` -> `dotnet test ../../tests/LocalMe.Core.Tests`
- `nx build core-domain` -> `dotnet build src/LocalMe.Core.csproj -c Release`
- `nx audit core-domain` -> `dotnet list src/LocalMe.Core.csproj package --vulnerable`

## 4. Test & Verification Rules
- 100% of domain logic is unit-tested with fast, in-memory property tests (FsCheck / xUnit).
- Invariant tests verify DAG acyclicity, reference counting increments/decrements, and exact Rial non-negative boundaries.
- Mocking is strictly forbidden for pure domain models.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- All monetary amounts use `RialAmount` storing signed/unsigned 64-bit integer Rials (`IRR`). No floating-point or intermediate Toman math.
- All timestamps use UTC ISO-8601 (`DateTimeOffset.UtcNow`).
- Capabilities resolve deterministically to infrastructure primitives with atomic reference counting.

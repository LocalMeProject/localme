---
project_name: "data-plane"
profile: "A"
stack: "dotnet-10-csharp-14"
scope: "backend"
owner: "team-data-plane"
tier_overrides: []
---

# Project Agent Manifest: data-plane

## 1. Scope & Business Intent
`data-plane` provides the high-performance in-process middleware and execution engines for tenant capabilities under `/_baas/v1/*`. This includes the `IBlobStorageAdapter` abstraction layer (Runflare, Arvan, ParsPack, MinIO, LocalDisk), the Jint 4.x sandboxed JavaScript engine host, the e-Namad compliance responder, Dynamic SQL pipeline streaming, and financial IPG callback bridging.

## 2. Architectural Profile & Boundaries
- **Profile**: A (Backend & Core Services: Hexagonal / DDD Ports & Adapters)
- **Primary Inputs**: Inbound ASP.NET Core HTTP middleware pipeline requests under `/_baas/v1/*` and edge regulatory routes.
- **Allowed Outbound Dependencies**:
  - `libs/core-domain`
  - `libs/contracts`
- **Forbidden Dependencies**:
  - Direct UI or mobile presentation packages.

## 3. Local Nx Target Delegations
- `nx lint data-plane` -> `dotnet format --verify-no-changes`
- `nx test data-plane` -> `dotnet test ../../tests/LocalMe.Core.Tests`
- `nx build data-plane` -> `dotnet build src/LocalMe.DataPlane.csproj -c Release`
- `nx audit data-plane` -> `dotnet list src/LocalMe.DataPlane.csproj package --vulnerable`

## 4. Test & Verification Rules
- All `IBlobStorageAdapter` implementations must pass the identical compliance test battery (put, get, delete, presigned URL).
- Jint script execution must enforce memory limits (16MB) and strict execution timeouts (5s) without unmanaged heap leakage.
- e-Namad meta tag injection must stream without whole-buffer copying.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- Storage operations never store files inside PostgreSQL `BYTEA` or Redis.
- Outbound egress calls route strictly through whitelisted static IP pools.
- Pure managed memory allocation: `Options.AllowClr()` is never enabled for untrusted tenant scripts.

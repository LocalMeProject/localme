---
project_name: "infrastructure"
profile: "A"
stack: "dotnet-10-csharp-14"
scope: "backend"
owner: "team-infra"
tier_overrides: []
---

# Project Agent Manifest: infrastructure

## 1. Scope & Business Intent
`infrastructure` manages persistent database schemas for PostgreSQL 18.1 (`control_plane`, tenant schemas, analytics, billing), Redis 7/8 streams, pre-compiled Lua scripts (GCRA rate limiter, fenced Redlock, OTP verification), and authoritative DNS server hosting via `ARSoft.Tools.Net`.

## 2. Architectural Profile & Boundaries
- **Profile**: A (Backend & Core Services: Hexagonal / DDD Secondary Adapters)
- **Primary Inputs**: Internal repository calls from Control Plane and Data Plane engines.
- **Allowed Outbound Dependencies**:
  - `libs/core-domain`
  - `libs/data-plane`
  - Managed PostgreSQL 18.1 and Redis 7/8
- **Forbidden Dependencies**:
  - Direct UI or mobile presentation packages.

## 3. Local Nx Target Delegations
- `nx lint infrastructure` -> `dotnet format --verify-no-changes`
- `nx test infrastructure` -> `dotnet test ../../tests/LocalMe.Core.Tests`
- `nx build infrastructure` -> `dotnet build src/LocalMe.Infrastructure.csproj -c Release`
- `nx audit infrastructure` -> `dotnet list src/LocalMe.Infrastructure.csproj package --vulnerable`

## 4. Test & Verification Rules
- Database migration DDL scripts must execute cleanly on PostgreSQL 18.1.
- Redis Lua scripts must execute atomically with zero syntax errors.
- Schema partitioning follows expand/contract invariants.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- Connection string targets the single physical `localme` database with schema-level isolation (`control_plane`, `prj_{slug}`).
- WAL slot replication is forbidden; real-time CDC uses application write interception + PG `LISTEN/NOTIFY`.
- All timestamps persist as UTC ISO-8601 (`TIMESTAMPTZ`).

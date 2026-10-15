---
project_name: "server"
profile: "A"
stack: "dotnet-10-csharp-14"
scope: "backend"
owner: "team-platform"
tier_overrides: []
---

# Project Agent Manifest: server

## 1. Scope & Business Intent
`server` is the consolidated ASP.NET Core 10 Web host for LocalMe. It operates as a modular monolith capable of booting distinct node roles (`edge`, `control`, `data`, `worker`, or `all`) using configuration flags. It hosts the Kestrel web server, YARP reverse proxy, in-process ACME SSL, regulatory compliance routes, and BaaS capability endpoints under `/_baas/v1/*`.

## 2. Architectural Profile & Boundaries
- **Profile**: A (Backend & Core Services: Hexagonal / DDD Application Host)
- **Primary Inputs**: Inbound HTTP/1.1, HTTP/2, and WebSocket connections on ports 80/443.
- **Allowed Outbound Dependencies**:
  - `libs/core-domain`
  - `libs/data-plane`
  - `libs/infrastructure`
- **Forbidden Dependencies**:
  - Direct UI frontend packages.

## 3. Local Nx Target Delegations
- `nx lint server` -> `dotnet format --verify-no-changes`
- `nx test server` -> `dotnet test ../../tests/LocalMe.Core.Tests`
- `nx build server` -> `dotnet build src/LocalMe.Server.csproj -c Release`
- `nx audit server` -> `dotnet list src/LocalMe.Server.csproj package --vulnerable`

## 4. Test & Verification Rules
- Role-based startup must initialize only the services configured for the active role.
- Health check endpoints (`/healthz`) must return 200 OK within 100ms.
- All request logging tags client IP as domestic Iranian or international.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- Process traps SIGTERM/SIGINT and gracefully drains active connections within 15 seconds.
- All timestamps exchanged via headers or JSON payloads use UTC ISO-8601.

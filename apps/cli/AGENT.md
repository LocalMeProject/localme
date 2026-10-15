---
project_name: "cli"
profile: "A"
stack: "dotnet-10-csharp-14"
scope: "backend"
owner: "team-devtools"
tier_overrides: []
---

# Project Agent Manifest: cli

## 1. Scope & Business Intent
`cli` is the developer command-line interface tool (`localme`) for LocalMe. It provides developer workflows for initializing projects (`localme init`), deploying immutable web bundles (`localme deploy ./dist`), inspecting platform health, managing encrypted secrets, and generating typed client SDKs.

## 2. Architectural Profile & Boundaries
- **Profile**: A (Backend & Core Services: Hexagonal / DDD CLI Adapter)
- **Primary Inputs**: User CLI arguments and standard input.
- **Allowed Outbound Dependencies**:
  - `libs/core-domain`
  - `libs/data-plane`
- **Forbidden Dependencies**:
  - Direct UI presentation frameworks.

## 3. Local Nx Target Delegations
- `nx lint cli` -> `dotnet format --verify-no-changes`
- `nx test cli` -> `dotnet test ../../tests/LocalMe.Core.Tests`
- `nx build cli` -> `dotnet build src/LocalMe.Cli.csproj -c Release`
- `nx audit cli` -> `dotnet list src/LocalMe.Cli.csproj package --vulnerable`

## 4. Test & Verification Rules
- CLI commands return non-zero exit codes on failure.
- Deployment packaging creates SHA-256 hashed content-addressable artifact manifests.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- Secrets are never displayed in plaintext unless explicitly requested via authenticated `--reveal` flag.
- Output formats default to human-readable with `--json` option for CI/CD scripting.

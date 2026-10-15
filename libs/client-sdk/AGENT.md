---
project_name: "client-sdk"
profile: "D"
stack: "typescript-5.7"
scope: "shared"
owner: "team-sdk"
tier_overrides: []
---

# Project Agent Manifest: client-sdk

## 1. Scope & Business Intent
`client-sdk` is the official TypeScript/JavaScript client library (`@localme/sdk`) for web, node, and hybrid mobile applications. It wraps LocalMe BaaS endpoints into an ergonomic client: Mobile OTP authentication, Dynamic SQL zero-alloc queries, SignalR and MQTT realtime pub/sub, TUS resumable uploads, sandboxed Jint function calls, and Shaparak/Zarinpal IPG flow.

## 2. Architectural Profile & Boundaries
- **Profile**: D (Shared Contracts & Core Libraries)
- **Primary Inputs**: Application code in client projects.
- **Allowed Outbound Dependencies**:
  - `libs/contracts`
- **Forbidden Dependencies**:
  - Direct database drivers or server-internal assemblies.

## 3. Local Nx Target Delegations
- `nx lint client-sdk` -> `pnpm tsc --noEmit`
- `nx test client-sdk` -> `pnpm test`
- `nx build client-sdk` -> `pnpm tsc`
- `nx audit client-sdk` -> `pnpm audit --audit-level high`

## 4. Test & Verification Rules
- Wire format tests verify matching requests against OpenAPI 3.1 contracts.
- Offline and reconnect handling for SignalR and Domestic MQTT channels.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- All client-side financial helpers convert Rials to Tomans via `toToman(irrBigInt)` strictly for presentation.
- Tokens are automatically refreshed via rotation before expiration.

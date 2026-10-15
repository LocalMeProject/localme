---
project_name: "contracts"
profile: "D"
stack: "openapi-3.1-json"
scope: "shared"
owner: "team-platform"
tier_overrides: []
---

# Project Agent Manifest: contracts

## 1. Scope & Business Intent
`contracts` defines the formal OpenAPI 3.1 specifications and JSON schema wire contracts for the LocalMe platform. It acts as the contract-first source of truth for all client SDK generation (TypeScript, Swift, Kotlin, Dart) and API gateway validation.

## 2. Architectural Profile & Boundaries
- **Profile**: D (Shared Contracts & Core Libraries)
- **Primary Inputs**: Formal API definitions covering Authentication, Dynamic SQL, Realtime, Storage, and Payments.
- **Allowed Outbound Dependencies**: Zero runtime dependencies.
- **Forbidden Dependencies**: Implementation code, databases, transport libraries.

## 3. Local Nx Target Delegations
- `nx lint contracts` -> schema validation
- `nx test contracts` -> contract backward-compatibility check
- `nx build contracts` -> bundle schema artifacts
- `nx audit contracts` -> security inspection

## 4. Test & Verification Rules
- Schemas must validate against OpenAPI 3.1 meta-schemas.
- Breaking changes must follow expand/contract lifecycle with SemVer bumping.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- All monetary fields in contracts specify integer `IRR` with descriptions noting presentation conversions.
- Timestamps strictly require `format: date-time` with UTC indicators.

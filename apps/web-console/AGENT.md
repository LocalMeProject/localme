---
project_name: "web-console"
profile: "B"
stack: "react-19-ts-vite"
scope: "frontend"
owner: "team-frontend"
tier_overrides: []
---

# Project Agent Manifest: web-console

## 1. Scope & Business Intent
`web-console` is the developer portal web application for the LocalMe platform. Built with React 19, TypeScript, Vite, and Tailwind CSS following Apple Design principles (refined typography, subtle glassmorphism, responsive tactile interactions), it enables developers to create projects, visualize their DAG Dependency Matrix in real time, monitor Rial (IRR) wallets, manage AES-256-GCM secrets, and track deployment artifacts.

## 2. Architectural Profile & Boundaries
- **Profile**: B (Web Applications: Clean Component & State Layering)
- **Primary Inputs**: User interactive events and authenticated REST/SignalR calls to the LocalMe Control Plane.
- **Allowed Outbound Dependencies**:
  - `libs/contracts`
  - `libs/client-sdk`
- **Forbidden Dependencies**:
  - Backend server runtime assemblies or native C# code.

## 3. Local Nx Target Delegations
- `nx lint web-console` -> `pnpm tsc --noEmit`
- `nx test web-console` -> `pnpm test`
- `nx build web-console` -> `pnpm build`
- `nx audit web-console` -> `pnpm audit --audit-level high`

## 4. Test & Verification Rules
- Clean component layering: presentation components decoupled from state hooks.
- Accessible: conforms to WCAG 2.2 AA standards with keyboard navigation and semantic HTML.
- Dark mode first with crisp high-contrast surfaces.

## 5. Approved Tier 2 Deviations
| Rule | Justification | ADR Reference |
|---|---|---|
| *(None by default)* | - | - |

## 6. Project Invariants
- Zero unauthenticated secret leakage; tokens masked by default.
- Currency formatting always displays exact Rial (`IRR`) alongside readable Persian Toman formatting.

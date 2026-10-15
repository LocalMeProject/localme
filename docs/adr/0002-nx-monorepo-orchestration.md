---
id: "ADR-0002"
title: "Nx Monorepo Task Orchestration and Polyglot Target Delegation"
status: "Accepted"
date: "2026-10-15"
deciders:
  - "Sina Vali"
  - "LocalMe Core Architecture Team"
affected_projects:
  - "apps/server"
  - "apps/cli"
  - "apps/web-console"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
  - "libs/contracts"
  - "libs/client-sdk"
tier_override: false
---

# ADR-0002: Nx Monorepo Task Orchestration and Polyglot Target Delegation

## 1. Context and Problem Statement
The LocalMe platform encompasses .NET 10 backend components, TypeScript client SDKs, a React/Vite developer portal, and shared contracts. Managing disconnected CI scripts or disparate build commands across subprojects leads to CI drift, flaky builds, and uncoordinated task dependencies.

## 2. Decision Drivers
- Unified monorepo orchestration standard (Prime Directive P1).
- Consistent CLI developer experience across languages (`nx lint`, `nx test`, `nx build`, `nx audit`).
- Deterministic affected task execution (`nx affected`) and computation caching.

## 3. Considered Options
- **Option 1**: Separate poly-repo layout for each language.
- **Option 2**: Ad-hoc root shell scripts / Makefiles without dependency graph tracking.
- **Option 3**: Nx monorepo with `nx:run-commands` delegating to native language toolchains (dotnet, pnpm, tsc, vite).

## 4. Decision Outcome
**Chosen Option**: Option 3 (Nx Monorepo with standard target contracts). Every subproject exposes `project.json` implementing `lint`, `test`, `build`, and `audit`.

## 5. Consequences
### Positive Consequences
- Fast CI feedback loop using `nx affected`.
- Consistent enterprise governance contracts across all subprojects.
- Local computation cache speeds up development builds.

### Negative Consequences / Trade-Offs
- Requires Node.js and pnpm at the root for repository orchestration.

### Neutral Consequences
- Project developers continue using native toolchains locally (`dotnet build`, `pnpm dev`) within subdirectories when preferred.

## 6. Compliance & Verification Strategy
- **Automated Verification**: `python3 scripts/verify-nx-targets.py` in CI and pre-commit hooks.
- **Test Implementation**: CI workflow gatekeeper evaluates `nx-pipeline` results.
- **Review Checkpoint**: Any new project must include standard target contracts in `project.json`.

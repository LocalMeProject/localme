---
id: repo:localme/cross-cutting/testing
parent: repo:localme/cross-cutting
title: Testing and CI
level: repo
kind: cross-cutting
applies_to: [repo:localme]
domains:
  - platform
  - data
keywords:
  - testing
  - vitest
  - ci
  - contract
---

# Testing and CI

The repository mandates strict testing and Continuous Integration (CI) practices prior to merge.

## Architecture
- **Framework:** Vitest
- **Total Tests:** 341 tests across 28 suites.
- **Dialect Contract (`tests/db/document-store.contract.ts`):** This is a shared test suite that is executed against *both* the SQLite in-memory database and a live Postgres database. This guarantees that neither SQL dialect diverges in behavior.

## Scripts
- `bun run test` - Runs the full suite against the default in-memory SQLite database.
- `bun run test:postgres` - Runs the dialect contract against Postgres (requires `DATABASE_URL`).
- `bun run typecheck` - Runs `tsc --noEmit`.
- `bun run lint` - Runs ESLint.

## CI Workflow
`.github/workflows/ci.yml` runs all the above scripts on every Pull Request and push to `main`. The codebase must be kept deployable at all times.

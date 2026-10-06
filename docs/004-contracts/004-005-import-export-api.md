---
id: repo:localme/contracts/import-export
parent: repo:localme/contracts
title: Import/Export API Contract
level: repo
kind: contract
parties: [client, projects]
domains:
  - projects
  - data
keywords:
  - export
  - import
  - backup
  - zip
---

# Import/Export API Contract

Endpoints for completely exporting or importing a project workspace, including configuration, assets, and database documents.

## Endpoints

- `GET /api/export/all` - Exports the entire project (database, config, storage assets) as a downloadable ZIP archive or JSON payload.
- `POST /api/import/all` - Imports a previously exported project payload, rebuilding the project's state.

These endpoints ensure users have full data portability and provide an easy migration or backup mechanism at the project level, complementary to the global `bun run backup` tool.

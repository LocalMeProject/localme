---
id: repo:localme/flows/project-export
title: Project Export Flow
level: repo
kind: contract
domains:
  - projects
  - data
flows:
  - project:export
keywords:
  - export
  - backup
  - zip
implements:
  - project:export
---

# Project Export Flow

## Purpose
Allows users to package and download their entire project workspace (including configuration, database, and storage assets) into a single ZIP file for backup or migration.

## Participants
- **projects**: Compiles the configuration and settings.
- **data**: Retrieves all JSON database documents and static file assets from `storage_data/`.

## Steps
1. The developer issues a request to `/api/export/all` with their project API key or session.
2. The platform queries the SQLite/Postgres database for all project configuration and document collections.
3. The platform fetches all associated assets from the project's namespace in `storage_data/`.
4. The system aggregates this data into a structured JSON payload and compresses it into a ZIP archive.
5. The ZIP file is streamed back to the client.

## Domain References
- `repo:localme/contracts/import-export`: Defines the REST API endpoints.

## Failure Modes
- Disk read timeout or permission errors in the `storage_data/` volume.
- Project size exceeds maximum ZIP memory constraints (requires streaming architecture).

## Change Entry Point
This doc is the entry point for any change that touches this flow. Start impact discovery here.

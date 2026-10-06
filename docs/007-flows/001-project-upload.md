---
id: repo:localme/flows/project-upload
title: Project Upload Flow
level: repo
kind: contract
domains:
  - projects
  - data
flows:
  - project:upload
keywords:
  - upload
  - assets
  - deploy
  - minification
implements:
  - project:upload
---

# Project Upload Flow

## Purpose
Handles uploading static files to a user's project or shared library, applying minification if enabled, and invalidating the in-process cache so changes are immediately live.

## Participants
- **projects**: Resolves the destination path (project-scoped or `library`).
- **data**: Stores the actual binary asset to disk in `storage_data/`.

## Steps
1. The developer or agent submits an asset to the storage API.
2. The platform validates the user has write access to the target project.
3. If `storage.minify_on_save` is true (and not overridden by `?minify=0`), the platform strips comments and whitespace from CSS/JS/JSON/HTML/SVG.
4. The file is written to the persistent single-volume storage under the project's namespace.
5. The in-process cache for this path is invalidated.
6. The new asset is immediately available via the project's serving URL.

## Domain References
- `repo:localme/contracts/storage-api`: Defines the REST endpoints for upload.

## Failure Modes
- Disk quota exceeded (per-tier constraints).
- Write failure to the single-volume storage.
- Minification syntax error (falls back to saving original file).

## Change Entry Point
This doc is the entry point for any change that touches this flow. Start impact discovery here.

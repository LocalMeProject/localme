---
id: repo:localme/contracts/storage-api
parent: repo:localme/contracts
title: Storage API Contract
level: repo
kind: contract
parties: [client, data-service, projects]
domains:
  - data
  - projects
keywords:
  - storage
  - files
  - upload
  - library
---

# Storage API Contract

File storage API for uploading and managing static assets and shared library resources.

## Endpoints

- `POST /api/storage/upload` - Uploads a file (multipart/form-data). Supports automatic minification via `storage.minify_on_save` and `?minify=0` overrides.
- `DELETE /api/storage/:path` - Deletes a stored file.
- `GET /{username}/{project}/{path}` - Serves an uploaded file.
- `GET /{username}/library/{path}` - Serves a shared asset from the CDN namespace.

Assets are served with Brotli/gzip compression, strong ETags, conditional 304s, and Referer/Origin hotlink protection.

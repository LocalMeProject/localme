---
id: repo:localme/contracts/project-config-api
parent: repo:localme/contracts
title: Project Configuration API Contract
level: repo
kind: contract
parties: [client, projects]
domains:
  - projects
keywords:
  - config
  - routes
  - proxy
  - secrets
  - webhooks
---

# Project Configuration API Contract

Provides REST endpoints to manage project-level settings, access control, and routing.

## Endpoint Groups

- **Keys (`/api/keys`)**: Manage API keys for the project, configuring the 15 granular permission grants.
- **Roles & Visitors (`/api/roles`, `/api/visitors`)**: Manage visitor roles and individual visitor accounts.
- **Routes (`/api/routes`)**: Configure custom rewrite rules and fallback behaviors for the project's serving domain.
- **Proxy (`/api/proxy`)**: Configure reverse proxy mounts to forward requests to external endpoints, enabling CORS bridging or backend masking.
- **Secrets (`/api/secrets`)**: Manage encrypted secrets that can be injected into proxy headers via `{{KEY}}` substitution.
- **Webhooks (`/api/webhooks`)**: Configure data event webhooks and view delivery outbox histories.

These configurations take effect immediately and are applied by the edge serving logic.

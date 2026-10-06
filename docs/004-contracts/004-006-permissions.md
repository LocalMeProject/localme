---
id: repo:localme/contracts/permissions
parent: repo:localme/contracts
title: Permissions Contract
level: repo
kind: contract
parties: [client, auth-service]
domains:
  - auth
keywords:
  - permissions
  - grants
  - api keys
  - roles
---

# Permissions Contract

Defines the granular access control system used for API keys and visitor roles.

## API Key Grants
API keys can be configured with up to 15 documented granular permissions, mapping to specific database operations (e.g., collection read/write/delete), storage upload capabilities, or configuration management.

## Visitor Roles
Visitors are authenticated at a project scope and assigned roles that implicitly grant sets of these permissions for client-side API consumption. 

## Endpoints and Routing
A route can gate access based on:
1. A specific visitor role.
2. A single explicit permission (`required_permission`).
3. Both.

All API access verifies either the session cookie (for visitors) or the `Authorization: Bearer <API key>` / `X-API-Key` headers.

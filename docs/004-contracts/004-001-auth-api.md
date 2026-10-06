---
id: repo:localme/contracts/auth-api
parent: repo:localme/contracts
title: Auth API Contract
level: repo
kind: contract
parties: [client, auth-service]
domains:
  - auth
keywords:
  - auth
  - login
  - captcha
  - session
---

# Auth API Contract

Provides endpoints for visitor and admin authentication.

## Endpoints

- `GET /auth/captcha` - Returns SVG captcha and encrypted sum.
- `POST /api/auth/login` - Validates credentials and captcha, sets secure HTTP-only session cookie.
- `POST /api/auth/logout` - Clears session cookie.
- `POST /api/agent/request-aat` - Requests an ephemeral Agent Access Token (AAT) for MCP integration, requiring human consent at `/auth/consent`.

Authentication is handled via session cookies for browsers, or `Authorization: Bearer <API key>` and `X-API-Key: <API key>` headers for API clients. Visitor sessions are first-class and project-scoped.

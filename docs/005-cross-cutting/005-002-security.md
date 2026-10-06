---
id: repo:localme/cross-cutting/security
parent: repo:localme/cross-cutting
title: Security and Authentication
level: repo
kind: cross-cutting
applies_to: [repo:localme]
domains:
  - auth
  - platform
keywords:
  - security
  - permissions
  - api keys
  - hashing
---

# Security and Authentication

The platform enforces strict security boundaries due to its multi-tenant, zero-backend-code nature.

## Secrets and Hashing
- **Passwords:** Hashed at rest using `scrypt` (Node.js crypto).
- **API Keys:** Hashed at rest; the raw key is only displayed once upon generation.
- **Data Encryption:** Webhook secrets and proxy mount secrets (`{{KEY}}` substitutions) are encrypted with AES-256-GCM using the `SESSION_SECRET`.
- **Sessions:** HMAC-signed cookies prevent tampering.

## Access Control
- **Roles:** Visitors possess project-scoped roles. Operators have platform-wide management access (except destructive actions). Admins possess full platform control.
- **Granular Permissions:** API endpoints check against 15 documented granular API key grants or the corresponding visitor role.
- **Anti-Hotlink:** Storage requests are checked against `Referer` and `Origin` headers compared with the *forwarded* request host, securing assets against unauthorized third-party embeds (can be disabled via `serving.hotlink_protection`).

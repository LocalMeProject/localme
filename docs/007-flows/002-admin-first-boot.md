---
id: repo:localme/flows/admin-first-boot
title: Admin First Boot Flow
level: repo
kind: contract
domains:
  - auth
  - platform
flows:
  - auth:admin-first-boot
keywords:
  - first-boot
  - admin creation
  - zero config
implements:
  - auth:admin-first-boot
---

# Admin First Boot Flow

## Purpose
Ensures the platform can be initialized immediately without prior configuration, by creating an initial administrator account on the first database connection if no users exist.

## Participants
- **auth**: Creates the account with admin privileges.
- **platform**: Detects the empty database state during `/health` probe.

## Steps
1. A request is made to `/health`.
2. The platform queries the user database. If zero users exist, the first-boot routine triggers.
3. The platform creates an admin account using `ADMIN_INITIAL_USERNAME` (default: `admin`) and `ADMIN_INITIAL_PASSWORD` (default: `admin1234`).
4. If `SESSION_SECRET` is unset, the platform generates one and stores it in `system_configs` (`platform.session_secret`).
5. The routine disables itself permanently once a user exists.

## Domain References
- `repo:localme/contracts/auth`: Authentication logic and roles.

## Failure Modes
- Database connection failure.
- In production (`NODE_ENV=production`), if `ALLOW_DEFAULT_ADMIN_PASSWORD` is not set to `1`, the creation is refused to prevent security risks.

## Change Entry Point
This doc is the entry point for any change that touches this flow. Start impact discovery here.

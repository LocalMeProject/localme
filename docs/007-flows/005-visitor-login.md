---
id: repo:localme/flows/visitor-login
title: Visitor Login Flow
level: repo
kind: contract
domains:
  - auth
flows:
  - auth:visitor-login
keywords:
  - visitor
  - session
  - captcha
implements:
  - auth:visitor-login
---

# Visitor Login Flow

## Purpose
Authenticates end-users of hosted projects to grant them project-scoped roles via secure HTTP-only sessions.

## Participants
- **auth**: Issues the captcha, validates credentials, and creates the session.

## Steps
1. The client requests a captcha from `/auth/captcha`.
2. The user submits the login form to `/api/auth/login` containing the username, password, project ID, and the solved captcha sum.
3. The platform validates the captcha.
4. The platform hashes the provided password and compares it to the stored scrypt hash.
5. If successful, the platform creates an HTTP-only session cookie scoped to the visitor.
6. Subsequent requests from the visitor to `/api/db/*` or `/api/storage/*` automatically apply their project-scoped permissions.

## Domain References
- `repo:localme/contracts/auth-api`: Authentication API specifications.

## Failure Modes
- Invalid captcha or credentials (triggers account lockout after repeated failures).
- Project is suspended (login rejected).

## Change Entry Point
This doc is the entry point for any change that touches this flow. Start impact discovery here.

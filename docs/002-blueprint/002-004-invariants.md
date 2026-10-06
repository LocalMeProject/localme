---
id: repo:localme/blueprint/invariants
parent: repo:localme/blueprint
title: Invariants
level: repo
kind: blueprint
domains:
  - platform
  - culture
keywords:
  - invariants
  - constraints
---

# Invariants

- **Docs Lead, Code Follows:** No non-trivial change is made without first defining the impact surface in the documentation graph.
- **Single-Volume Persistent Storage:** The database (if SQLite) and uploaded assets (`storage_data/`) must coexist on a single persistent volume to survive container rebuilds effortlessly.
- **Multi-Culture is First-Class:** Cultures (`fa-IR` and `en-US`) are embedded at the core level. Dates are mathematically computed (Shamsi calendar), the document direction (RTL/LTR) flips universally, and wording is runtime-editable. There are no English fallbacks for missing translations—missing keys result in build errors.
- **Zero-Config First Boot:** The platform must be able to boot with zero configuration. It automatically provisions an initial admin account and generates a session secret upon the first request to an empty database.
- **Security & Sandboxing:** API keys are hashed at rest, visitor sessions are strictly project-scoped, and anti-hotlink validation compares the `Referer` against the forwarded request host.

---
id: repo:localme/blueprint/non-goals
parent: repo:localme/blueprint
title: Non-Goals
level: repo
kind: blueprint
domains:
  - platform
keywords:
  - out of scope
  - non-goals
---

# Non-Goals

- **Server-Side Code Execution:** The platform will never execute user-provided server-side logic (e.g., Node.js, Python). Projects consist exclusively of static assets and calls to the documented platform API.
- **Horizontal Scaling:** The architecture is designed for a single-server deployment. Resource scaling is achieved by vertically upgrading the server, not by deploying multiple instances behind a load balancer (which would complicate the local SQLite and disk-based storage models).
- **Complex Relational User Data:** The project database is a JSON document store designed for MVP needs, not a complex relational schema engine for end-users.

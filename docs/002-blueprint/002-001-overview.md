---
id: repo:localme/blueprint/overview
parent: repo:localme/blueprint
title: Overview
level: repo
kind: blueprint
domains:
  - platform
keywords:
  - overview
  - intent
  - baas
---

# Overview

LocalMe is an enterprise-grade Backend-as-a-Service (BaaS) for frontend-only applications. Users write HTML, CSS, and JavaScript, upload it, and the platform provides everything else: a JSON document database, file and asset storage, visitor accounts with roles and permissions, routing, encrypted secrets, a reverse proxy, a shared asset library, scheduled tasks, webhooks, custom domains, and usage reporting.

The platform is deployed as a single Next.js (App Router) application. The console and the platform API live in one codebase, and every hosted project is served over HTTP by the same server, backed by SQLite or Postgres. No server-side user code is ever executed.

---
id: repo:localme/cross-cutting/frontend-routing
parent: repo:localme/cross-cutting
title: Frontend Routing and Serving
level: repo
kind: cross-cutting
applies_to: [repo:localme]
domains:
  - platform
  - projects
keywords:
  - routing
  - serving
  - frontend
  - proxy
---

# Frontend Routing and Serving

The Next.js App Router serves both the platform's UI (admin console, dashboard, documentation) and the dynamically routed content for hosted projects.

## Platform Routes
- `/admin/*`: The operator and admin console.
- `/dashboard/*`: The user dashboard for project management.
- `/auth/*`: Login, Captcha, and Agent Access Token (AAT) consent UI.
- `/docs/*`: API documentation and HTTP contract specs.
- `/account/*`, `/profile/*`: Account management endpoints.
- `/skills/*`: Serves the `SKILL.md` for AI agent consumption.

## Project Serving
Projects are dynamically served via internal wildcard handling (e.g., `app/~serving/` folder structure).
- `/{username}/{project}/*`: Project-specific static assets and HTML files. Serves a `404.html` fallback if present, and processes project-specific proxy routes and URL rewrites.
- `/{username}/library/*`: Serves global assets from the user's shared CDN namespace.
- `/~public/*`: The platform's curated, public asset library available across all workspaces.

Project serving uses bounded in-process caching, Brotli/gzip compression, and strongly validated ETags to ensure edge performance, managed at the Next.js runtime level.

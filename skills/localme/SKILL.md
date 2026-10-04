---
name: localme
description: Comprehensive agent guide for interacting with LocalMe hosting, storage, routing, and document databases via MCP, REST APIs, and autonomous Agent Access Tokens (AAT).
---

# LocalMe Agent Skill & Operational Guide

This skill guides AI agents in autonomously controlling and developing applications on the **LocalMe** platform using the native MCP (Model Context Protocol) server, the REST API, and human-in-the-loop Agent Access Tokens (AAT).

---

## 1. Overview & Architecture

LocalMe is a high-performance web platform designed with two guiding KPIs:
1. **User Frontend**: Self-explanatory, clean, accessible, and intuitive so non-technical users can monitor their sites with zero friction.
2. **Autonomous Agent Backend**: Deeply controllable via MCP and API so users rarely need to do manual operations; agents can deploy projects, manage files, configure reverse proxy routes, store structured data, and run background tasks autonomously and safely.

### Quotas & Subscriptions (Configurable by SuperAdmin)
LocalMe features dynamic subscriptions (Free, Plus, and Pro tiers) whose names, prices, and limits are centrally managed by the platform SuperAdmin in Platform Settings (`system_configs` under `subscription.tiers`):
- **Free Tier**:
  - Up to **3 projects**.
  - **3 MB** storage cap per project.
  - **3 MB** shared user library storage cap.
- **Plus Tier**:
  - Up to **50 projects**.
  - **50 MB** storage cap per project.
  - **50 MB** shared user library storage cap.
  - Upgraded via ZarinPal online payment or SuperAdmin override.
- **Pro Tier**:
  - Custom / high-capacity project and storage quotas for teams and power users.
  - Configured and activated dynamically via SuperAdmin settings.
- **Token Pools**:
  - **Personal Access Tokens (PAT)**: Up to **10** active per user (permanent or auto-rotating, with a 1-hour grace period).
  - **Agent Access Tokens (AAT)**: Up to **50** active per user (ephemeral, 4-hour or 1-day TTL, strictly requires human consent).

---

## 2. Authentication: The Autonomous Agent Token (AAT) Workflow

To interact with LocalMe without requiring the human user to expose or copy permanent secrets, autonomous agents must use the **Agent Access Token (AAT)** flow with local token sharing.

### Step 1: Check Local Token Cache
Before requesting a new token, check if a valid `localme-aat.txt` exists in the workspace root:
1. Read `localme-aat.txt` if present.
2. Check token validity by making a POST request:
   ```http
   POST /api/agent/check
   Content-Type: application/json

   {
     "token": "aat_..."
   }
   ```
3. If `{ "valid": true, "remainingSeconds": ... }`, use this token directly in the `Authorization: Bearer aat_...` header.

### Step 2: Request New Ephemeral Access (When Missing or Expired)
If `localme-aat.txt` does not exist or the token is expired/invalid:
1. Send an authorization request:
   ```http
   POST /api/agent/request-aat
   Content-Type: application/json

   {
     "username": "<localme_username>",
     "clientName": "Antigravity Assistant",
     "tokenName": "Workspace Session",
     "description": "Autonomous development and deployment tasks",
     "requestedDuration": "4h"
   }
   ```
2. The server responds with:
   ```json
   {
     "requestId": "req_...",
     "consentUrl": "/auth/consent?requestId=req_...",
     "pollUrl": "/api/agent/poll-aat?requestId=req_...",
     "status": "pending",
     "expiresAt": "..."
   }
   ```
3. **Prompt the Human User**:
   Print the full consent URL (e.g., `http://localhost:3000/auth/consent?requestId=req_...` or your production domain) and ask the user to confirm access:
   > "Please open the following link to authorize temporary access for this session: [Authorize LocalMe Access](http://localhost:3000/auth/consent?requestId=req_...)"
4. **Poll for Approval**:
   Poll `GET /api/agent/poll-aat?requestId=req_...` every 2–3 seconds until:
   ```json
   {
     "status": "approved",
     "token": "aat_...",
     "expiresAt": "..."
   }
   ```
5. **Persist the Token**:
   Write the approved `aat_...` string to `localme-aat.txt` in the workspace root. All subsequent runs and subagents can read this file directly.

> **Security Note**: Never auto-renew without human confirmation. When an AAT expires, prompt the user for consent again.

---

## 3. Connecting to LocalMe via MCP (Model Context Protocol)

LocalMe implements the official **Model Context Protocol (Spec 2024-11-05)** with complete support for Tools, Prompts, Resources, and Resource Templates. It provides both an HTTP JSON-RPC 2.0 endpoint and a stdio bridge.

### HTTP Endpoint
- **URL**: `http://localhost:3000/api/mcp` (or remote URL: `https://localme.ir/api/mcp`)
- **Protocol**: JSON-RPC 2.0
- **Supported Methods**:
  - `initialize` (negotiates protocol version `2024-11-05` and server capabilities)
  - `tools/list` & `tools/call`
  - `prompts/list` & `prompts/get` (`deploy-static-site`, `manage-document-db`, `configure-reverse-proxy`)
  - `resources/list` & `resources/read` (`localme://system/overview`, `localme://system/routes`, `localme://system/stats`)
  - `resources/templates/list` (`localme://docs/{topic}`)
  - `ping` & `logging/setLevel`
- **Header**: `Authorization: Bearer <aat_... or pat_...>`

### Stdio MCP Server Bridge
For desktop agents (Antigravity, Cursor, Claude Desktop), configure the server in your MCP config:
```json
{
  "mcpServers": {
    "localme": {
      "command": "node",
      "args": ["d:/Work/Projects/localme/bin/mcp-server.mjs"],
      "env": {
        "LOCALME_URL": "http://localhost:3000",
        "LOCALME_API_KEY": "aat_your_token_here"
      }
    }
  }
}
```

---

## 4. Available MCP Tools

Agents can call the following tools:

### Information & Account
| Tool | Description | Parameters |
|---|---|---|
| `localme_get_docs` | Read documentation on platform features, DSL, and routing. | `topic`: `"overview"`, `"api"`, `"database"`, `"files"`, `"routes"`, `"cron"`, `"webhooks"`, `"subscriptions"`, `"runflare"` |
| `localme_get_account` | Retrieve tier, project quota, storage caps, and usage. | None |
| `localme_list_projects` | List all projects owned by the account. | None |
| `localme_get_project` | Get metadata for a specific project. | `projectId`: number |
| `localme_create_project` | Create a new project within tier quota. | `name`: string |
| `localme_delete_project` | Permanently delete a project and its storage. | `projectId`: number |

### File & Asset Management
| Tool | Description | Parameters |
|---|---|---|
| `localme_list_files` | List files and directories in project storage. | `projectId`: number, `prefix`?: string |
| `localme_get_file` | Read the content of a file (UTF-8 text or Base64 binary). | `projectId`: number, `path`: string |
| `localme_write_file` | Create or overwrite a file in project storage. | `projectId`: number, `path`: string, `content`: string, `encoding`?: `"utf-8"` \| `"base64"` |
| `localme_delete_file` | Delete a file from project storage. | `projectId`: number, `path`: string |

> **Tip**: Project root files are served at `/{username}/{projectname}/`. Placing `index.html` at the root serves it as the default homepage. Files in the reserved folder `/library/` resolve to the user's shared asset library.

### Dynamic Routing & Reverse Proxy
| Tool | Description | Parameters |
|---|---|---|
| `localme_list_routes` | List configured URL route rules and proxy mounts. | `projectId`: number |
| `localme_create_route` | Create a static route rewrite or proxy forwarding mount. | `projectId`: number, `pathPattern`: string, `targetFile`?: string, `isProxy`?: boolean, `proxyUpstream`?: string, `requiresAuth`?: boolean |
| `localme_delete_route` | Remove an existing routing rule. | `projectId`: number, `routeId`: number |

### Embedded Document Database
Each project comes with an embedded JSON document database:
| Tool | Description | Parameters |
|---|---|---|
| `localme_db_query` | Query documents with filters, sorting, and pagination. | `projectId`: number, `table`: string, `filter`?: object, `sort`?: object, `limit`?: number, `skip`?: number |
| `localme_db_insert` | Insert a new JSON document into a collection. | `projectId`: number, `table`: string, `document`: object |
| `localme_db_update` | Patch an existing document by its ID. | `projectId`: number, `table`: string, `id`: string \| number, `patch`: object |
| `localme_db_delete` | Remove a document from a collection. | `projectId`: number, `table`: string, `id`: string \| number |

### Environment Secrets
| Tool | Description | Parameters |
|---|---|---|
| `localme_list_secrets` | List secret variable keys for a project (values masked). | `projectId`: number |
| `localme_set_secret` | Store an encrypted environment variable (AES-256-GCM). | `projectId`: number, `key`: string, `value`: string |

---

## 5. Instant Live Serving & Autonomous E2E Testing

LocalMe hosts projects with zero-build static serving and immediate live execution. Every file written via MCP (`localme_write_file`) or the REST API is instantly accessible on the public web.

### Project URLs
- **Standard Platform URL**:
  `https://localme.ir/{username}/{project}/` (or `http://localhost:3000/{username}/{project}/` in development)
- **Subdomain URL**:
  `https://{project}.localme.ir/` (when project subdomain routing is enabled)
- **Custom Domain**:
  `https://custom-domain.com/` (when attached and verified)

### Cache Update Grace Period (5–10 Seconds)
LocalMe utilizes high-performance memory caching and HTTP headers (`stale-while-revalidate`, etags, and fast-path serving).
- Whenever you upload, modify, or delete project files or update route configurations, **wait 5 to 10 seconds** before initiating automated E2E tests.
- This grace period guarantees that in-memory serving caches, reverse proxy mounts, and edge CDN nodes synchronize with the newest revision.

### Autonomous E2E Testing Workflow
Agents should never assume a deployment succeeded merely because the file write API returned `200`. Conduct full End-to-End (E2E) verification by directly visiting the live project URL:

1. **Verify HTTP Status & Content Integrity**:
   - Issue an HTTP GET request to `https://localme.ir/{username}/{project}/` (or your active platform origin).
   - Confirm status code is `200 OK`.
   - Inspect the HTML payload to ensure the `<title>`, essential navigation elements, and primary UI containers render correctly without server errors or 404s.
2. **Verify Static Asset Resolution**:
   - Fetch linked CSS stylesheets, JavaScript scripts, and images (e.g., `/{username}/{project}/style.css` or shared `/library/...` files).
   - Confirm each asset returns `200 OK` with the appropriate `Content-Type` header (`text/css`, `application/javascript`, image MIME types).
3. **Verify Interactive & Database Flows**:
   - If the application submits data to LocalMe's embedded document database (via `POST /api/db/insert` or project-relative APIs):
     - Send a test payload simulating user interaction.
     - Call `localme_db_query` to verify that the newly submitted record actually exists in the collection.
4. **Verify Route Rewrites & Auth Protection**:
   - If the project configures custom route rules or `requiresAuth`:
     - Test unauthenticated requests to protected endpoints to verify they reject or redirect appropriately.
     - Test authenticated or public routes to confirm proxy forwarding works cleanly.
5. **Report Direct Live Link to User**:
   - Conclude your operation by providing the clickable, verified live URL so the user can inspect the final result in their browser.

---

## 6. Container & Runflare Deployment Best Practices

When deploying LocalMe to a container runtime or PaaS (Runflare, Docker, Railway, Coolify, VPS):

### Smart Container Startup (`scripts/runflare-start.mjs`)
To eliminate container startup probe timeouts (`SIGTERM`) caused by redundant dependency installation or Next.js compilation, LocalMe provides a smart container entrypoint:
```bash
npm run runflare:start
# or
node scripts/runflare-start.mjs
```
- **Zero-Delay Startup**: Checks if `node_modules` and `.next` are already present from the build phase; skips redundant steps immediately.
- **Automatic Migrations**: Executes `node scripts/migrate.mjs` safely and idempotently, auto-creating database directories recursively if needed.
- **Fast Binding**: Starts Next.js and binds port `3000` in **under 2 seconds**, satisfying container orchestrator health checks.
- **Graceful Termination**: Handles `SIGTERM` and `SIGINT` signals gracefully.

### Runflare Container Settings
Configure your Runflare container with these exact values:
- **Command**: `npm run runflare:start`
- **PostStart**: `sh -c "sleep 2 && curl -fs http://127.0.0.1:3000/health || true"`
- **PreStop**: `sleep 5`

### Single Persistent Volume Strategy (e.g., 2GB Volume)
When given a single persistent volume (e.g. 2GB) in Runflare:
1. Mount the volume to `/app/storage_data`.
2. Configure the following environment variables:
   ```env
   STORAGE_DATA_DIR="/app/storage_data"
   DB_PATH="file:/app/storage_data/localme.db"
   ```
This stores both the SQLite database and all project uploaded files inside the same persistent volume, completely surviving container redeployments and restarts without data loss.

### Sequence of Manual Build/Publish Commands (Reference)
1. **Dependency Installation**: `npm ci` (or `npm install`)
2. **Type Check (Optional Quality Gate)**: `npm run typecheck`
3. **Database Schema Migrations**: `npm run db:migrate`
4. **Optimized Production Build**: `npm run build`
5. **Start Production Server**: `npm run start` (or `npm run runflare:start`)


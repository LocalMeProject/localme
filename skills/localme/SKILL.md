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

### Quotas & Tiers
- **Free Tier (Default)**:
  - Up to **3 projects**.
  - **3 MB** storage cap per project.
  - **3 MB** shared user library storage cap.
- **Plus Tier**:
  - Up to **50 projects**.
  - **50 MB** storage cap per project.
  - **50 MB** shared user library storage cap.
  - Upgraded via ZarinPal v4 payment or SuperAdmin override.
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

## 3. Connecting to LocalMe via MCP

LocalMe provides both an HTTP JSON-RPC endpoint and a stdio bridge.

### HTTP Endpoint
- **URL**: `http://localhost:3000/api/mcp` (or your remote URL on Runflare: `https://your-app.runflare.run/api/mcp`)
- **Protocol**: JSON-RPC 2.0 (Methods: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`)
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

## 5. Runflare Deployment Best Practices

When deploying LocalMe to Runflare:
1. **GitHub Continuous Deployment**: Link the repository to Runflare with auto-deploy on push.
2. **Persistent Storage Volume**:
   - Runflare containers are stateless by default.
   - Mount a persistent volume to `/app/storage_data` to ensure uploaded static assets and SQLite databases persist across restarts.
   - Set environment variable: `STORAGE_DATA_DIR=/app/storage_data`.
3. **Port & Host Binding**:
   - LocalMe starts with `next start --hostname 0.0.0.0 --port ${PORT:-3000}`.
   - Runflare automatically injects `$PORT`.
4. **Health Check**:
   - Healthcheck URL: `/api/health` returns `{ "status": "ok" }`.

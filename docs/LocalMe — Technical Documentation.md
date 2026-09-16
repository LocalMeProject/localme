# LocalMe — Technical Documentation

**Version**: 1.0.0  
**Date**: 2026-07-23  
**Status**: Final — Implementation Reference

---

## 1. Purpose

This document provides the technical implementation details for the LocalMe platform. It is intended for developers, system administrators, and technical stakeholders who need to understand the internal workings, APIs, data flows, and operational procedures of the platform. It complements the Blueprint by offering deep technical specifications.

---

## 2. System Overview

LocalMe is an enterprise-grade Backend-as-a-Service (BaaS) platform built on **.NET 10** (backend) and **Next.js 16.2** (frontend). It runs on a single server (Ubuntu 24.04) with PostgreSQL 18.4 as the database. All services are modular, decoupled, and follow dependency injection principles.

**Key Technical Characteristics:**
- **Single-threaded event loop for the frontend** (Next.js server components).
- **Multi-threaded native async I/O** for the backend (.NET 10).
- **Database-backed persistence** for sessions, rate limits, and all stateful data.
- **Local disk storage** for files (no external S3).
- **Automatic SSL provisioning** via Let's Encrypt (Certes).

---

## 3. Backend Architecture (.NET 10)

### 3.1 Hosting Model

The backend uses **ASP.NET Core Minimal API** with the following middleware pipeline (in order):

1. `UseExceptionHandler` — Global exception handling.
2. `UseSerilogRequestLogging` — Structured logging.
3. `UseRateLimiting` — Custom rate limiting middleware.
4. `UseSessionResolution` — Resolves session from cookie/header.
5. `UseAuthentication` — JWT and API key authentication.
6. `UseAuthorization` — Role/permission checks.
7. `UseRouting` — Route resolution (platform routes vs. project routes).
8. `UseWatermark` — Injects watermark HTML into HTML responses.
9. `UseStaticFiles` — Serves static assets (if not handled by routing).
10. `UseEndpoints` — Maps API and proxy endpoints.

### 3.2 Dependency Injection (DI) Container

All services are registered as **scoped** (per request) unless otherwise specified:

| Service Interface | Implementation | Lifetime | Notes |
| :--- | :--- | :--- | :--- |
| `IStorageProvider` | `LocalDiskStorageProvider` | Scoped | Wraps file system operations. |
| `IDatabaseService` | `PostgresDatabaseService` | Scoped | Executes JSONB queries via Dapper. |
| `IRoutingService` | `RoutingService` | Scoped | Caches route mappings in memory (5 min). |
| `IAuthService` | `AuthService` | Scoped | Handles JWT creation/validation, password hashing. |
| `IAuthorizationService` | `AuthorizationService` | Scoped | Checks roles/permissions against session. |
| `ISecretsService` | `SecretsService` | Scoped | Decrypts secrets on demand (cache in memory). |
| `IProxyService` | `ProxyService` | Scoped | Uses YARP for HTTP forwarding. |
| `IWebhookService` | `WebhookService` | Scoped | Queues webhook events. |
| `ICronService` | `CronService` | Singleton | Hosted service using Quartz.NET. |
| `IRateLimiter` | `PostgresRateLimiter` | Scoped | Database-backed rate limit checks. |
| `ISessionService` | `PostgresSessionService` | Scoped | Session CRUD operations. |
| `ISSLService` | `CertesSSLService` | Singleton | Handles Let's Encrypt provisioning/renewal. |
| `IImportExportService` | `ImportExportService` | Scoped | ZIP/JSON import/export. |

**Singleton services** are thread-safe and use concurrent collections or locks where needed.

### 3.3 Request Pipeline Details

#### 3.3.1 Authentication Middleware

- Extracts `mvp_session` cookie (HttpOnly).
- If present, loads session from PostgreSQL.
- Validates session expiry (sliding expiration of 20 minutes).
- If no session, creates a new anonymous session (auto-generated `session_id`).
- Stores session in `HttpContext.Items["Session"]`.

**API Key Authentication**:
- Checks `X-API-Key` header.
- If present, validates against hashed keys in `api_keys` table.
- Creates a temporary session context with the project and role associated with the key.
- No persistent session is created for API key calls.

#### 3.3.2 Rate Limiting Middleware

- Uses `System.Threading.RateLimiting.SlidingWindowRateLimiter`.
- Checks rate limits for the current session (or IP fallback).
- Stores counts in PostgreSQL (`rate_limits` table) to survive restarts.
- Returns `429 Too Many Requests` if limit exceeded.

**Implementation Pseudo-Code**:
```csharp
var sessionId = sessionService.GetSessionId(context);
var key = $"{sessionId}:{routePattern}";
var window = TimeSpan.FromMinutes(1);
var limit = GetLimitForUser(session);
var count = await rateLimiter.GetOrAddAsync(key, window);
if (count >= limit) return Results.StatusCode(429);
await rateLimiter.IncrementAsync(key);
```

#### 3.3.3 Routing Middleware

- Checks if the request path matches any **platform reserved prefix** (`/api`, `/auth`, `/admin`, `/dashboard`, `/library`, `/~public`).
- If not, resolves the project from the URL path: `/{username}/{projectname}/...`.
- If the project is resolved, checks the `routes` table for a matching path pattern.
- If a route is found:
  - If `is_proxy` is true, forwards the request via YARP (with header injection).
  - Otherwise, serves the target HTML file from storage (or streams it).
- If no route matches, attempts to serve a static file from storage.
- If still not found, checks for `404.html`; otherwise, returns platform 404.

#### 3.3.4 Watermark Middleware

- Intercepts all responses with `Content-Type: text/html`.
- Buffers the response body, injects watermark HTML just before `</body>`.
- Uses `Response.Body` interception with a `MemoryStream` (small overhead, acceptable).

---

## 4. Database Layer

### 4.1 Connection Management

- Uses Npgsql with connection pooling enabled (default: max pool size 100).
- Connection string stored in `appsettings.json` (or environment variables).
- All queries executed via Dapper's `QueryAsync` / `ExecuteAsync` with **parameterized SQL**.

### 4.2 JSONB Query Translation

The Database Service translates the MongoDB-like DSL into SQL:

**Example Filter**:
```json
{ "age": { "$gt": 18 }, "active": true }
```

**Generated SQL**:
```sql
SELECT * FROM project_data
WHERE project_id = @projectId
  AND table_name = @tableName
  AND (document->>'active')::boolean = true
  AND (document->>'age')::int > 18
ORDER BY ... LIMIT ... OFFSET ...
```

**Supported Operators Mapping**:
- `$eq` → `=`
- `$ne` → `<>`
- `$gt` → `>` (cast to appropriate type)
- `$gte` → `>=`
- `$lt` → `<`
- `$lte` → `<=`
- `$in` → `IN` (array)
- `$nin` → `NOT IN`
- `$regex` → `~` (PostgreSQL regex)
- `$exists` → `IS NOT NULL` / `IS NULL`
- `$and` → `AND`
- `$or` → `OR`
- `$not` → `NOT`

**Type Inference**: The system attempts to infer the JSONB value type (string, number, boolean, null) to cast appropriately.

### 4.3 Indexing Strategy

- **GIN index** on `project_data(document)` for general querying.
- **BTREE index** on `project_data(project_id, table_name)` for filtering.
- **Partial indexes** for commonly queried fields (if used heavily, can be added dynamically by admin).

### 4.4 Migration Strategy

- **No automatic migrations** (user data is schema-less JSONB).
- **Platform schema migrations** managed via DbUp or EF Core migrations (only for system tables).
- System tables (`users`, `projects`, `routes`, etc.) are fixed schema.

---

## 5. File Storage Layer

### 5.1 LocalDiskStorageProvider

**Base Path**: `/var/mvp/storage/`

**Methods**:
- `WriteAsync(string path, Stream stream)` → Creates directories, writes file.
- `ReadAsync(string path)` → Returns `FileStream` (with `FileShare.Read`).
- `DeleteAsync(string path)` → Deletes file/directory (recursive).
- `ListAsync(string path)` → Returns `FileSystemInfo` metadata.
- `ExistsAsync(string path)` → Returns boolean.

**Atomic Write** (used for editor saves):
1. Write to `{path}.tmp`.
2. Rename `{path}.tmp` → `{path}` (atomic on same file system).

**Concurrency**: Reads are lock-free; writes are serialized per project via `SemaphoreSlim`.

### 5.2 Compression & Minification

- **On Save**: 
  - If file extension is `.html`, `.htm`, `.css`, `.js` → minify using NUglify.
  - Compress the resulting bytes using `BrotliStream` (compression level 9).
  - Store the compressed bytes.
- **On Read (Download)**:
  - Read compressed bytes from disk.
  - Set `Content-Encoding: br` and stream bytes directly.
- **On Editor Open**:
  - Read compressed bytes.
  - Decompress using `BrotliStream`.
  - Beautify (format) using NUglify's `Minify` with beautify options.
  - Return to frontend for display.

**Fallback**: If a file is not minifiable (binary), store as-is without compression (user must compress manually).

### 5.3 Storage Cap Enforcement

- Before any write/upload, check `total_used` for the user (sum of all projects + library).
- If `total_used + new_size > user.storage_cap_bytes`, return `402 Payment Required`.
- The cap is a **hard limit**.

---

## 6. Authentication & JWT

### 6.1 Platform Authentication

- **Password Hashing**: BCrypt with work factor 12.
- **Login Attempts**: Tracked in `users` table (`failed_login_attempts`, `lockout_until`).
- **CAPTCHA**: Math expression (`a + b = ?`) rendered as SVG (using `System.Drawing.Common`). Answer stored in session.

**JWT Generation** (for platform users):
```json
{
  "sub": "user_id",
  "role": "Admin|Operator|User",
  "exp": "timestamp"
}
```
- Algorithm: HMAC-SHA256 (symmetric key).
- Expiry: 20 minutes (sliding renewal on each request).

### 6.2 Visitor Authentication (Per Project)

- **Credentials**: Stored in `visitors` table, hashed with BCrypt.
- **JWT per project**:
```json
{
  "sub": "visitor_id",
  "project_id": "project_id",
  "role": "role_name",
  "permissions": { ... },
  "exp": "timestamp"
}
```
- Cookie: `auth_{projectId}` with `Path=/{username}/{projectname}/`.
- Sliding expiration: 20 minutes.

### 6.3 API Key Authentication

- **Generation**: UUID v4, hashed with BCrypt and stored in `api_keys` table.
- **Validation**: Check `X-API-Key` header, compare hash.
- **Scoped to**: Project ID and Role (permissions derived from role).
- **No session**: Stateless, rate-limited per key.

---

## 7. Reverse Proxy (YARP)

**YARP** (Yet Another Reverse Proxy) is used for proxy routes. It is integrated into the pipeline via `UseYarp`.

**Configuration** per proxy route:
- **Target URL**: Resolved at runtime (secrets are substituted).
- **Headers**: Injected from proxy config (secret values resolved).
- **Timeout**: Configurable (default 30 seconds).
- **Forwarding**: All request bodies streamed (no buffering).

**Proxy Resolution**:
1. Routing middleware matches `/api/stripe/*` to a proxy route.
2. `Yarp` forwards the request to the target with modified headers.
3. Response is streamed back to the client.

**Secret Substitution**: `{{SECRET_KEY}}` replaced with decrypted secret value from `secrets` table (project-scoped).

---

## 8. Cron Scheduler (Quartz.NET)

**Quartz.NET** runs as a hosted service (`IHostedService`). It loads job configurations from the `cron_configs` table and schedules them.

**Job Implementation** (all jobs implement `IJob`):

| Job Class | Trigger | Execution Logic |
| :--- | :--- | :--- |
| `CleanExpiredSessionsJob` | Daily (2 AM) | `DELETE FROM sessions WHERE expires_at < NOW()` |
| `CleanOldLogsJob` | Daily (3 AM) | `DELETE FROM visit_logs WHERE visited_at < retention_date` (per project retention) |
| `GenerateDailyStatsJob` | Daily (1 AM) | Aggregates previous day's `visit_logs` into `daily_project_stats` |
| `SendDailySummaryWebhookJob` | Daily (8 AM) | For each project with a configured webhook, sends summary payload |
| `CleanOrphanedUploadsJob` | Weekly (4 AM) | Deletes temp upload files older than 24 hours |

**Scheduling**:
- Each job reads its schedule from `cron_configs` table (`parameters` JSONB contains `schedule` or uses the default).
- If `is_enabled` is `false`, the job is unscheduled.

**Execution Isolation**:
- Each job runs in its own Quartz.NET JobDetail instance.
- Execution timeouts: 60 seconds (configurable).
- If a job times out, it is aborted and logged.

---

## 9. Webhooks

**Queue**: `ConcurrentQueue<WebhookEvent>` (in-memory) processed by a `BackgroundService`.

**Delivery**:
1. Event is enqueued (non-blocking).
2. `WebhookDispatcher` service processes events sequentially (per webhook, to avoid rate limit issues).
3. Sends HTTP POST with JSON payload.
4. Logs response (status, body) in `webhook_deliveries` table.
5. Rate limit: 100 requests/minute globally (admin configurable).

**Payload Structure**:
```json
{
  "event": "user.login",
  "timestamp": "2026-07-23T12:00:00Z",
  "project_id": 123,
  "data": {
    "username": "john_doe",
    "role": "Member"
  }
}
```

**HMAC Signature**: If `secret` is configured, adds `X-Webhook-Signature: HMAC-SHA256(secret, payload)`.

---

## 10. SSL Provisioning (Certes)

**Certes** is used for automatic Let's Encrypt certificate management.

**Flow**:
1. User registers a domain → `domains` table entry created with `verification_token`.
2. User adds TXT record to their DNS: `_acme-challenge.{domain}` → token.
3. User clicks "Verify" → `SslService` checks DNS record.
4. Upon success, Certes orders a certificate via ACME v2.
5. Certificate (PEM) and private key stored in PostgreSQL (encrypted).
6. Kestrel is updated to use the new certificate (requires restart or `IWebHost` dynamic update? We'll use `ICertificateStore` hook in .NET 10 to reload certificates dynamically).
7. Certificate auto-renews 30 days before expiry.

**Certificate Storage**:
- `domains.ssl_certificate` (TEXT) — PEM certificate chain.
- `domains.ssl_private_key` (TEXT) — Encrypted private key (AES-256-GCM) using `ENCRYPTION_KEY`.

**Dynamic Reloading**: .NET 10 supports `ICertificateStore` with `AddKeyPerCertificate` for SNI. We implement a custom store that reads from the database.

---

## 11. Import/Export Implementation

### 11.1 Export

- **Per Feature**:
  - Query the relevant table (e.g., `routes` for project).
  - Return JSON array.
  - Secrets: return only keys (values omitted).
- **All Export (ZIP)**:
  - Create a temporary directory (or use `MemoryStream`).
  - Copy all files from project storage and library to `lib/` and `storage/` subdirectories.
  - Write `config/secrets.json` with clear text values.
  - Write `config/config.json` with all other configurations (routes, api, roles, cron, webhooks, dns, auth).
  - Zip the directory using `System.IO.Compression.ZipFile`.
  - Stream the ZIP to the client.

**Memory Optimization**: Stream ZIP directly without writing to disk.

### 11.2 Import

- **Per Feature**:
  - Validate JSON against schema (using `System.Text.Json` with `JsonSchema` or manual validation).
  - Overwrite existing records (delete old, insert new).
- **All Import (ZIP)**:
  - Extract ZIP to temporary folder.
  - Validate `config/config.json` and `config/secrets.json`.
  - Restore files to storage/library (user option: merge or replace).
  - Apply configurations (overwriting).

---

## 12. Frontend (Next.js 16.2)

### 12.1 Architecture

- **App Router** for all pages.
- **Server Components** for static/dashboard pages (data fetching via API).
- **Client Components** for interactive parts (Monaco editor, file manager, form interactions).
- **API Routes** (Next.js) act as a BFF (Backend for Frontend) — proxy requests to the .NET API (with session cookie forwarding).

### 12.2 Authentication Flow (Frontend)

1. User logs in via `/auth/login` page (server-rendered).
2. POST to `/auth/token` (handled by Next.js API route that forwards to backend).
3. Upon success, sets `mvp_session` cookie (HttpOnly) via the backend response.
4. Client redirects to the dashboard.
5. All subsequent API calls include the session cookie (browser handles automatically).

### 12.3 Monaco Editor Integration

- **Package**: `@monaco-editor/react` (v4.6.0).
- **Customizations**:
  - Language support: HTML, CSS, JavaScript, JSON, Plain Text.
  - Extensions: Prettier, ESLint loaded from public CDN (to avoid user storage).
  - Save triggers: `Ctrl+S` sends file content to `/api/storage/upload` (with multipart).
  - Preview: Real-time iframe preview (using project's route).

### 12.4 File Manager

- **UI**: Table view with columns: Name, Size, Modified, Actions.
- **Actions**:
  - Download, Delete, Move to Library, Edit (opens in Monaco).
- **Upload**: Drag-and-drop or file picker (ZIP extraction handled by backend).

### 12.5 Routing Configuration UI

- List of routes with fields: Path, Target File, Requires Auth, Required Role, Is Proxy (toggle).
- Proxy config expands with: Target URL, Method, Headers (with secret selector), Timeout.
- Route deletion/creation via modal.

---

## 13. API Endpoints — Detailed Specifications

### 13.1 Database Endpoints

All endpoints require session or API key authentication.

**`POST /api/db/find`**

Request:
```json
{
  "table": "users",
  "filter": { "age": { "$gt": 18 }, "active": true },
  "sort": { "name": 1 },
  "limit": 50,
  "offset": 0
}
```

Response:
```json
{
  "data": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**`POST /api/db/insert`**

Request:
```json
{
  "table": "users",
  "document": { "id": 1, "name": "John", "age": 30, "active": true }
}
```

Response:
```json
{ "success": true, "id": 1 }
```

**`POST /api/db/update`**

Request:
```json
{
  "table": "users",
  "filter": { "id": 1 },
  "update": { "age": 31 }
}
```

Response:
```json
{ "success": true, "modified": 1 }
```

**`POST /api/db/delete`**

Request:
```json
{
  "table": "users",
  "filter": { "id": 1 }
}
```

Response:
```json
{ "success": true, "deleted": 1 }
```

### 13.2 Storage Endpoints

**`GET /api/storage/list?path=/`**

Response:
```json
[
  { "name": "index.html", "size": 1024, "modified": "2026-07-23T12:00:00Z", "type": "file" },
  { "name": "static", "size": 0, "modified": "...", "type": "directory" }
]
```

**`POST /api/storage/upload`**

- Content-Type: `multipart/form-data`
- Fields: `file` (binary), `path` (string, optional, defaults to `/`)
- Response: `{ "success": true, "path": "/static/style.css", "size": 1234 }`

**`GET /api/storage/download?path=/static/style.css`**

- Returns file stream with `Content-Disposition: attachment` if download requested; otherwise inline.

**`POST /api/storage/delete`**

Request:
```json
{ "path": "/static/style.css" }
```

Response:
```json
{ "success": true }
```

**`GET /api/storage/status`**

Response:
```json
{ "used": 1234567, "total": 5242880, "files": 42 }
```

### 13.3 Library Endpoints (Similar to Storage)

- Paths are user-scoped (no project in URL).
- All methods are the same as Storage, but use library base path.

### 13.4 Auth Endpoints

**`POST /auth/token`**

Request:
```json
{
  "username": "john",
  "password": "secret",
  "captcha": "12",
  "returnUrl": "/user/proj/dashboard"
}
```

Response (if platform login):
```json
{
  "success": true,
  "redirectUrl": "/dashboard"
}
```

If visitor login (project):
```json
{
  "success": true,
  "redirectUrl": "/user/proj/dashboard",
  "projectId": 123,
  "token": "jwt_here"
}
```

**`GET /auth/logout`**

- Clears project-specific cookie.
- Redirects to `returnUrl` if provided.

### 13.5 Proxy Endpoint (Dynamic)

- Any route marked as `is_proxy=true` in the routing table.
- Forwards the request to the target with headers.
- Returns the external API response (streamed).

---

## 14. Error Handling & Logging

### 14.1 Global Exception Handler

- Catches all unhandled exceptions.
- Returns `500 Internal Server Error` with minimal details (to avoid info leakage).
- Logs full exception with Serilog (File + Console).

### 14.2 Logging

- **Serilog** configured with:
  - Console sink (for container/debug).
  - File sink (`/var/mvp/logs/backend.log`) with rolling (daily).
- Log levels:
  - `Information`: Request start/end, authentication success, cron job execution.
  - `Warning`: Rate limit exceeded, failed webhook.
  - `Error`: Exceptions, database connection failures.

**Structured Logging**:
```json
{
  "Timestamp": "2026-07-23T12:00:00Z",
  "Level": "Information",
  "Message": "User {Username} logged in",
  "Username": "john_doe",
  "ProjectId": 123
}
```

---

## 15. Configuration & Environment

### 15.1 `appsettings.json`

```json
{
  "Logging": { "LogLevel": { "Default": "Information" } },
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Port=5432;Database=localme;Username=localme_user;Password=***"
  },
  "Jwt": {
    "Secret": "***",
    "Issuer": "localme",
    "Audience": "localme",
    "ExpiryMinutes": 20
  },
  "Encryption": {
    "Key": "***" // 32-byte AES key, base64
  },
  "Storage": {
    "RootPath": "/var/localme/storage"
  },
  "Ssl": {
    "Email": "admin@localme.com",
    "StoragePath": "/var/localme/ssl"
  },
  "Cron": {
    "TimeoutSeconds": 60,
    "MaxConcurrentJobs": 5
  }
}
```

### 15.2 Environment Variables Override

All settings can be overridden by environment variables (e.g., `ConnectionStrings__Postgres`).

---

## 16. Build & Deployment

### 16.1 Backend Build

```bash
dotnet publish -c Release -o /opt/localme/backend
```

### 16.2 Frontend Build

```bash
npm run build
npm run export  # Standalone output
```

Copy output to `/opt/localme/frontend`.

### 16.3 Systemd Service Files

**Backend (`/etc/systemd/system/localme-backend.service`)**:
```
[Unit]
Description=LocalMe Backend
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/localme/backend
ExecStart=/usr/bin/dotnet LocalMe.Backend.dll
Restart=always
RestartSec=10
User=localme
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
```

**Frontend (`/etc/systemd/system/localme-frontend.service`)**:
```
[Unit]
Description=LocalMe Frontend
After=network.target

[Service]
WorkingDirectory=/opt/localme/frontend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
User=localme
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 16.4 NGINX Configuration

```nginx
server {
    listen 80;
    server_name localme.com *.localme.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name localme.com;

    ssl_certificate /etc/letsencrypt/live/localme.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/localme.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000; # Next.js
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:5000; # .NET backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://localhost:5000;
    }

    # Static assets (served directly by NGINX)
    location /_next/static/ {
        alias /opt/localme/frontend/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 16.5 Database Initialization

- Run migration script (DbUp) on first deployment.
- Seed initial admin user (username: `admin`, password generated and printed to console).

---

## 17. Testing Strategy

- **Unit Tests**: xUnit for service logic (mocked dependencies).
- **Integration Tests**: TestContainers for PostgreSQL, in-memory file system.
- **API Tests**: Postman/Newman collections for all endpoints.
- **Load Testing**: k6 scripts for rate limit and concurrent requests.

---

## 18. Performance Considerations

- **Database**: Connection pooling; GIN indexes; partition `visit_logs` by month.
- **File Storage**: Brotli compression; atomic writes; streaming.
- **Caching**: `IMemoryCache` for route metadata, secrets (5-min TTL).
- **Rate Limiting**: PostgreSQL-backed, but minimal overhead (single UPDATE per request).
- **Concurrency**: `SemaphoreSlim` per project for writes; reads are lock-free.

---

## 19. Security Hardening

- **Run as non-root user** (`localme`).
- **File permissions**: `700` for storage directories.
- **PostgreSQL**: Only allow localhost connections; use strong password.
- **HTTPS**: Enforce on all domains (HSTS headers).
- **Sensitive data**: Encrypt secrets with AES-256-GCM; never log them.
- **Input validation**: All inputs validated with `System.Text.Json` deserialization + schema.

---

## 20. Maintenance & Troubleshooting

### 20.1 Log Files
- `/var/localme/logs/backend.log`
- `/var/localme/logs/frontend.log`
- `/var/log/nginx/access.log`
- PostgreSQL logs: `/var/log/postgresql/`

### 20.2 Common Issues

| Issue | Diagnostic |
| :--- | :--- |
| SSL certificate not renewing | Check Certes logs; ensure DNS TXT record is reachable. |
| Rate limit errors | Check `rate_limits` table; adjust limits in `system_configs`. |
| File upload fails (size limit) | Check `max_upload_size_bytes` in config; NGINX `client_max_body_size`. |
| Database connection pool exhausted | Increase `MaxPoolSize` in connection string. |

---

**This document provides all technical details required to implement, deploy, and maintain the LocalMe platform. It should be used alongside the Blueprint for a complete understanding.**

*Document generated on 2026-07-23.*
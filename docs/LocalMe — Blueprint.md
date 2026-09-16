Minimum Viable Product (MVP) Platform — Enterprise Blueprint

Version: 1.0.0
Date: 2026-07-20
Status: Final — Source of Truth

---

1. Executive Overview

The Minimum Viable Product (MVP) Platform is an enterprise-grade Backend-as-a-Service (BaaS) that enables users to deploy fully functional web applications using only static frontend assets (HTML, CSS, JavaScript). The platform provides all backend services required for a modern MVP: database storage, file storage, asset libraries, authentication and authorization, routing, DNS management, reverse proxy with secrets, webhooks, and built-in scheduled tasks.

Core Value Proposition: Users (and AI agents) can focus entirely on frontend logic and user experience while the platform handles all infrastructure, security, and backend concerns.

Deployment Model: Single-server architecture (no horizontal scaling). The entire platform — frontend (Next.js) and backend (.NET 10) — runs on a single instance. Resource scaling is achieved by vertically upgrading the server.

---

2. Technology Stack

2.1 Frontend Platform

Component Technology Version Rationale
Framework Next.js (React) 16.2.10 Industry-standard React framework with App Router, Turbopack, and stable Adapter API . Supports SPA patterns with progressive server features .
Language TypeScript 5.8+ Type safety for enterprise-grade codebases.
UI Library shadcn/ui Latest Component library built on Radix UI and Tailwind CSS — minimal bundle size, accessible.
Styling Tailwind CSS 4.0+ Utility-first CSS framework.
State Management Zustand 5.0+ Minimal, scalable state management.
HTTP Client Fetch API (native) — No external dependency; built into Next.js.
Form Handling React Hook Form 7.0+ Performant form validation.
Validation Zod 3.0+ Schema validation for forms and API responses.

2.2 Backend Platform

Component Technology Version Rationale
Runtime .NET 10 (LTS) 10.0.10 Long-term support until November 2028 . Enterprise-grade, native threading, minimal memory footprint.
API Framework ASP.NET Core Minimal API 10.0 Production-ready, lower overhead than MVC, supports OpenAPI 3.1, built-in validation, and endpoint filters .
Language C# 14.0 Extension members, enhanced pattern matching, performance improvements .
ORM/Data Access Dapper 2.1+ Lightweight, micro-ORM with raw SQL performance. No heavy abstraction layers.
Database PostgreSQL 18.4 Production-ready RDBMS with JSONB support, async I/O, and skip-scan optimization .
Database Driver Npgsql 9.0+ ADO.NET provider for PostgreSQL.
Caching IMemoryCache (built-in) — Single-server, in-memory cache.
Rate Limiting System.Threading.RateLimiting — Built-in .NET 10 sliding window rate limiter.
Job Scheduling Quartz.NET 4.0+ Mature, industry-standard scheduler for built-in cron tasks.
Headless Browser PuppeteerSharp 20.0+ For executing cron job JavaScript files in a real browser environment.
SSL Automation Certes 3.0+ ACME (Let's Encrypt) client for automatic SSL certificate provisioning.
Logging Serilog 4.0+ Structured logging with file and console sinks.
Compression Brotli (built-in) — .NET 10 native Brotli compression for static assets.
Minification NUglify 1.0+ JavaScript/CSS/HTML minification on save.

2.3 Infrastructure

Component Technology Version Rationale
Operating System Ubuntu Server 24.04 LTS Industry-standard Linux distribution.
Web Server Kestrel + YARP 10.0 Kestrel for application serving; YARP for reverse proxy to external APIs.
Process Manager systemd — Native Linux service management.
Database PostgreSQL 18.4 Single-server installation.
File Storage Local Disk — Storage path: /var/mvp/storage/{userId}/{projectId}/
Backup Manual (user-initiated) — Users export projects via dashboard.

---

3. System Architecture

3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                        │
│              SSL Termination / Load Balancing                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────┐
│   Next.js 16.2    │               │  ASP.NET Core 10  │
│  (Frontend UI)    │               │  (Backend API)    │
│                   │               │                   │
│ • Admin Panel     │               │ • Database API    │
│ • User Dashboard  │               │ • Storage API     │
│ • Auth Pages      │               │ • Routing Engine  │
│ • Landing Pages   │               │ • Proxy Service   │
└───────────────────┘               │ • Webhooks        │
        │                           │ • Cron Scheduler  │
        │                           │ • SSL Manager     │
        │                           └─────────┬─────────┘
        │                                     │
        └──────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL 18.4                            │
│                                                                 │
│  • Users & Projects    • Sessions & Rate Limits                │
│  • Routes & APIs       • Roles & Permissions                   │
│  • Secrets (encrypted) • Webhook Configurations                │
│  • Visit Logs          • Daily Aggregated Stats                │
│  • System Configs      • Cron Job Configurations               │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      File System                                │
│                                                                 │
│  /var/mvp/storage/                                              │
│    └── {userId}/                                                │
│         └── {projectId}/                                        │
│              ├── index.html                                     │
│              ├── 404.html                                       │
│              ├── manifest.json                                  │
│              ├── sw.js                                          │
│              ├── static/                                        │
│              │    ├── style.css                                 │
│              │    └── app.js                                    │
│              └── ... (user files)                               │
│    └── libraries/                                               │
│         └── {userId}/                                           │
│              └── ... (library assets)                           │
└─────────────────────────────────────────────────────────────────┘
```

3.2 Service Decoupling

All backend services are designed as modular, decoupled components following the Dependency Inversion Principle. Each service is registered via dependency injection and can be tested, replaced, or extended independently.

Service Interface Implementation Responsibility
IStorageProvider IStorageProvider LocalDiskStorageProvider File read/write/delete operations
IDatabaseService IDatabaseService PostgresDatabaseService JSONB document store operations
IRoutingService IRoutingService RoutingService Route resolution and mapping
IAuthService IAuthService AuthService Authentication and token management
IAuthorizationService IAuthorizationService AuthorizationService Role and permission checks
ISecretsService ISecretsService SecretsService Encrypted secret storage and retrieval
IProxyService IProxyService ProxyService External API proxy with header injection
IWebhookService IWebhookService WebhookService Webhook event dispatching
ICronService ICronService CronService Built-in scheduled task execution
IRateLimiter IRateLimiter PostgresRateLimiter Per-session/per-IP rate limiting
ISessionService ISessionService PostgresSessionService Session creation, retrieval, and cleanup
ISSLService ISSLService CertesSSLService Automatic SSL certificate provisioning
IImportExportService IImportExportService ImportExportService JSON/ZIP import/export of configurations

---

4. Data Model

4.1 PostgreSQL Schema

```sql
-- Users (Platform authentication)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_operator BOOLEAN DEFAULT FALSE,
    storage_cap_bytes BIGINT DEFAULT 5242880, -- 5MB default
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_suspended BOOLEAN DEFAULT FALSE
);

-- Projects
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    storage_allocated_bytes BIGINT DEFAULT 0,
    free_visits_per_month INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, name)
);

-- Sessions (Persistent, database-backed)
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL, -- Contains project auth tokens, etc.
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Rate Limits (Persistent, database-backed)
CREATE TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
    ip TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    route_pattern TEXT,
    window_start TIMESTAMP NOT NULL,
    request_count INTEGER DEFAULT 1,
    UNIQUE(session_id, window_start, route_pattern)
);
CREATE INDEX idx_rate_limits_session ON rate_limits(session_id, window_start);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip, window_start);

-- Routes (User-defined routing)
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path_pattern TEXT NOT NULL, -- e.g., "/dashboard", "/api/stripe/*"
    target_file TEXT, -- e.g., "dashboard.html", null for proxy routes
    is_proxy BOOLEAN DEFAULT FALSE,
    proxy_config JSONB, -- { target, method, headers, timeout }
    requires_auth BOOLEAN DEFAULT FALSE,
    required_role TEXT, -- e.g., "Admin", "Member"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, path_pattern)
);

-- API Endpoints (Pre-defined, user-configurable enable/disable)
CREATE TABLE api_endpoints (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    endpoint_name TEXT NOT NULL, -- e.g., "db_find", "storage_list"
    is_enabled BOOLEAN DEFAULT TRUE,
    requires_auth BOOLEAN DEFAULT TRUE,
    required_role TEXT DEFAULT 'Member',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, endpoint_name)
);

-- Roles (Custom roles per project)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Editor", "Viewer"
    permissions JSONB NOT NULL, -- { "db_read": true, "storage_write": false, ... }
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, name)
);

-- Default roles inserted on project creation:
-- Owner (all permissions), Admin (all except project deletion), Member (read/write limited), Guest (read-only)

-- Visitors (Per-project visitor accounts)
CREATE TABLE visitors (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, username)
);

-- Secrets (Encrypted environment variables)
CREATE TABLE secrets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL, -- AES-256-GCM encrypted
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, key_name)
);

-- Cron Job Configurations (Built-in tasks)
CREATE TABLE cron_configs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL, -- e.g., "CleanExpiredSessions", "GenerateDailyStats"
    is_enabled BOOLEAN DEFAULT TRUE,
    parameters JSONB DEFAULT '{}', -- e.g., { "retention_days": 7 }
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, task_name)
);

-- Webhook Configurations
CREATE TABLE webhooks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT, -- Optional HMAC secret for verification
    events TEXT[] NOT NULL, -- e.g., ['project.created', 'user.login']
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook Delivery Logs
CREATE TABLE webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP DEFAULT NOW()
);

-- DNS Domain Registrations
CREATE TABLE domains (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domain TEXT UNIQUE NOT NULL, -- e.g., "mycoolapp.com"
    verification_token TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    ssl_certificate TEXT, -- PEM-encoded certificate
    ssl_private_key TEXT, -- Encrypted private key
    ssl_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Visit Logs (Raw)
CREATE TABLE visit_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
    route TEXT NOT NULL,
    visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,
    ip TEXT,
    user_agent TEXT,
    visited_at TIMESTAMP DEFAULT NOW(),
    is_unique BOOLEAN DEFAULT TRUE -- Deduplicated within 5-minute window
);
-- Partitioned by month for performance

-- Daily Aggregated Stats (Anonymized for admin reporting)
CREATE TABLE daily_project_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    project_id INTEGER, -- NULL for deleted projects (anonymized)
    total_visits INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_daily_stats_date ON daily_project_stats(date);
CREATE INDEX idx_daily_stats_project ON daily_project_stats(project_id);

-- System Configurations (Admin-editable)
CREATE TABLE system_configs (
    id SERIAL PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

4.2 JSONB Document Store (Database Service)

The Database Service uses PostgreSQL JSONB columns to store user data without requiring migrations.

Table Structure:

```sql
CREATE TABLE project_data (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    document JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, table_name, (document->>'id'))
);

CREATE INDEX idx_project_data_gin ON project_data USING GIN (document);
CREATE INDEX idx_project_data_table ON project_data(project_id, table_name);
```

Query DSL (MongoDB-style):

```json
{
  "filter": { "age": { "$gt": 18 }, "active": true },
  "sort": { "name": 1 },
  "limit": 50,
  "offset": 0
}
```

Supported Operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regex, $exists, $and, $or, $not

---

5. Service Definitions

5.1 Database Service

Purpose: Provide a document store for each project using PostgreSQL JSONB.

Endpoints:

· POST /api/db/find → { table, filter, sort, limit, offset }
· POST /api/db/insert → { table, document }
· POST /api/db/update → { table, filter, update }
· POST /api/db/delete → { table, filter }

Security:

· Requires authentication (session or API key).
· Validates that the caller has db_read/db_write permissions for the project.
· Sanitizes filter parameters (no SQL injection risk due to parameterized queries).
· Limits result set to 500 rows.

Performance: GIN indexes on JSONB columns for fast queries.

---

5.2 Storage Service

Purpose: Provide file storage for each project. No enforced folder structure.

Endpoints:

· GET /api/storage/list → Returns file tree with metadata (size, modified, type).
· POST /api/storage/upload → Multipart form upload (overwrites silently).
· GET /api/storage/download?path=/path/to/file → Streams file.
· POST /api/storage/delete → { path }
· GET /api/storage/status → { used, total, files }

Security:

· Validates storage cap before upload (hard cap).
· Path traversal prevention (sanitize .. and absolute paths).
· Requires storage_write permission for upload/delete.

Minification & Compression:

· On save via editor: Minify HTML/CSS/JS using NUglify.
· Compress all files using Brotli before storage.
· Serve with Content-Encoding: br and Cache-Control headers.

---

5.3 Library Service

Purpose: Per-user shared asset storage (5MB bonus). Accessible across all projects via /library/{path}.

Endpoints:

· GET /api/lib/list
· POST /api/lib/upload
· POST /api/lib/delete
· GET /api/lib/status

Security:

· HTML files are blocked (upload rejected).
· Files served via /library/{path} resolve to the current user's library.
· Rate limits: 1000 requests/minute per session.

Move to Library:

· In the Storage file manager, each file has a "Move to Library" button.
· Copies file from project storage to library, deletes from project.
· Returns new library path: /library/{path}.

Admin Public Library:

· Admin maintains a global public library at /~public/.
· Content curated by admin (no public upload).
· Higher rate limits (1000 requests/minute globally).

---

5.4 Routing Service

Purpose: User-defined URL routing with authorization rules.

Configuration (per project):

· User defines routes: { path: "/dashboard", target: "dashboard.html", requires_auth: true, required_role: "Admin" }
· Pre-defined routes: / → index.html, /404 → 404.html (customizable).

Reserved Prefixes (blocked from user configuration):

· /api/*
· /auth/*
· /admin/*
· /dashboard/*
· /library/*

API Endpoints Configuration:

· Users can enable/disable pre-defined API endpoints.
· Set authorization rules per endpoint.

Resolution Order:

1. Check if path matches a user-defined route → serve target file.
2. Check if path matches a static file (outside /api/*) → serve file.
3. Check if path matches index.html in a subdirectory → serve index.
4. Return 404 (or custom 404.html).

---

5.5 Authentication & Authorization Service

Purpose: Manage platform users (Admin, Operator, User) and project visitors.

Platform Authentication (Owners & Admins)

· Username + Password + Math CAPTCHA.
· 5 failed attempts → lockout for 5 minutes.
· Session stored in PostgreSQL (sessions table).
· Roles: Admin (full system control), Operator (read-only support), User (standard).

Visitor Authentication (Per Project)

· Visitors can sign up (default role: Member) or log in.
· Credentials stored per project in visitors table.
· Password hashed using bcrypt.
· Session stores project-scoped auth tokens in sessions.data JSONB.

Login Flow:

1. Visitor clicks "Login" → redirected to /auth/login?returnUrl=....
2. LocalMe serves built-in login page (or custom login.html if uploaded).
3. POST to /auth/token with username, password, captcha.
4. Backend validates, generates JWT, sets cookie: auth_{projectId} with Path=/{username}/{projectname}/.
5. Redirects to returnUrl.

Logout:

· GET /auth/logout?returnUrl=... clears project-specific token.

Roles & Permissions (per project):

· Pre-defined: Owner, Admin, Member, Guest.
· Custom roles: User-defined (e.g., Editor, Viewer).
· Permissions: db_read, db_write, db_admin, storage_read, storage_write, storage_admin, lib_read, lib_write, route_access_{routeId}.

API Key Authentication (for agents):

· User generates API key (UUID) scoped to a project and role.
· Key is hashed (bcrypt) and stored in PostgreSQL.
· Sent via X-API-Key header.
· Grants access to Storage and Library endpoints only (upload, list, status).
· Rate limit: 600 requests/minute.
· Auto-expires after 90 days of inactivity.

---

5.6 DNS Management Service

Purpose: Allow users to map custom domains to their projects.

Flow:

1. User registers domain in dashboard (e.g., mycoolapp.com).
2. System generates a verification token (TXT record).
3. User adds TXT record to their DNS provider.
4. User clicks "Verify" → system checks DNS record.
5. Upon verification, system provisions SSL certificate via Let's Encrypt (using Certes).
6. System updates routing table to map domain → project.
7. SSL certificate auto-renews 30 days before expiry.

SSL Implementation:

· Uses Certes ACME client.
· Certificates stored in PostgreSQL (domains table) as PEM-encoded strings.
· Kestrel configured to use certificates for SNI (Server Name Indication).

User Responsibility: User must have a DNS provider (Cloudflare, GoDaddy, Namecheap, etc.) and ability to add TXT/A records.

---

5.7 Reverse Proxy & Secrets Service

Purpose: Securely call external APIs without exposing secrets in client-side code.

Secrets Store

· User defines secrets in dashboard: { key: "STRIPE_KEY", value: "sk_live_..." }.
· Values are encrypted (AES-256-GCM) before storage.
· Secrets are never exposed in exports (names only, except in all export).

Proxy Configuration

In the Routing Service, users can enable "Proxy Mode" for a route:

```json
{
  "path": "/api/stripe/create-payment",
  "is_proxy": true,
  "proxy_config": {
    "target": "https://api.stripe.com/v1/payment_intents",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {{SECRET_STRIPE_KEY}}",
      "Content-Type": "application/json"
    },
    "timeout_seconds": 30
  },
  "requires_auth": true,
  "required_role": "Admin"
}
```

How it works:

1. Frontend JS calls /api/stripe/create-payment (relative).
2. Backend resolves {{SECRET_STRIPE_KEY}} from Secrets Store.
3. Backend forwards request to Stripe with rewritten headers.
4. Backend streams response back to frontend.

Security:

· Secrets never leave the server.
· Proxy endpoint respects role-based authorization.
· Rate limits apply.
· Logs proxy requests for debugging (no sensitive data logged).

---

5.8 Built-in Cron Tasks

Purpose: Provide predefined scheduled tasks that users can enable and configure.

The 5 Built-in Tasks:

Task Name Description Configurable Parameters Default Schedule
CleanExpiredSessions Deletes expired session records retention_days (default 7) Daily at 2 AM
CleanOldLogs Deletes visit logs older than retention period None (uses project's subscription-based retention) Daily at 3 AM
GenerateDailyStats Aggregates previous day's visit logs into daily_project_stats None Daily at 1 AM
SendDailySummaryWebhook Triggers configured webhook with daily summary webhook_id Daily at 8 AM
CleanOrphanedUploads Removes temporary upload files (reserved for future) None Weekly at 4 AM

User Configuration:

· Enable/disable each task.
· Set parameters (e.g., retention_days).
· View last run time and status.

Admin Control:

· Enable/disable tasks globally.
· Adjust schedules.
· Add new tasks (via code, not admin panel).

Implementation:

· Quartz.NET scheduler.
· Tasks run as BackgroundService in .NET.
· Each task is a separate job class implementing IJob.

---

5.9 Webhook Service

Purpose: Send HTTP POST requests to user-defined URLs on specific events.

Events:

· project.created
· project.updated
· project.deleted
· user.login
· user.signup
· storage.cap_exceeded
· cron.started
· cron.completed
· cron.failed

Configuration:

```json
{
  "url": "https://myapp.com/webhook",
  "secret": "hmac_secret_optional",
  "events": ["user.login", "project.created"],
  "is_active": true
}
```

Delivery:

· Non-blocking: events are queued and processed by a BackgroundService.
· HTTP POST with Content-Type: application/json.
· Payload includes: { "event": "...", "timestamp": "...", "data": {...} }
· HMAC-SHA256 signature added to X-Webhook-Signature header if secret is configured.

Rate Limit: 100 requests/minute globally (admin configurable).
Manual Trigger: "Test" button in dashboard sends a test payload.

Retry: No retries (as per requirement).

---

5.10 Import/Export Service

Purpose: JSON-based backup and restore for all project configurations.

Export Endpoints:

· GET /api/export/{feature} → Returns JSON for: routes, api, roles, secrets, cron, webhooks, dns, auth
· GET /api/export/all → Returns ZIP archive containing:
  · lib/ → All library files.
  · storage/ → All project storage files.
  · config/secrets.json → Clear text values (human-readable).
  · config/config.json → All other configurations (routes, api, roles, cron, webhooks, dns, auth).

Import Endpoints:

· POST /api/import/{feature} → Accepts JSON, validates against schema, overwrites.
· POST /api/import/all → Accepts ZIP, validates, applies.

Security:

· Only accessible to project Owner.
· Secrets export: in per-feature exports, only names are included (values redacted).
· In all export, secrets are included in clear text (user's full backup).

AI Integration:

· GitHub repository contains JSON schemas for each feature.
· Example config.json files for common project types.
· prompt.md for LLM guidance.

---

5.11 Rate Limiting Service

Purpose: Prevent abuse and ensure fair resource usage.

Storage: PostgreSQL-backed (persistent, survives server restarts).

Rules (per session, identified by mvp_session cookie):

Visitor Type Requests/Minute
Public (unauthenticated) 60
Authenticated (any role) 300
Admin/Owner 600
API Key 600
Assets (non-HTML) 1000
Library Assets 1000

Fallback: If no session cookie, fallback to IP address (30 requests/minute).

Implementation:

· System.Threading.RateLimiting with sliding window.
· PostgreSQL table stores counts per session/window.
· Cleanup job removes old rate limit entries (older than 7 days).

---

5.12 Session Management Service

Purpose: Manage user sessions persistently.

Storage: PostgreSQL-backed.

Session Data (JSONB):

```json
{
  "user_id": 123,
  "project_tokens": {
    "project_id_1": "jwt_token_1",
    "project_id_2": "jwt_token_2"
  },
  "current_project_id": 1,
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

Cleanup: CleanExpiredSessions cron task runs daily.

---

6. API Endpoints Summary

6.1 Public Endpoints (No Auth)

Endpoint Method Description
/auth/login GET Login page (built-in or custom)
/auth/token POST Authentication endpoint (username, password, captcha)
/auth/logout GET Logout (clears project token)
/auth/captcha GET CAPTCHA image generation
/{username}/{projectname}/ GET Project homepage (routed to index.html)
/{username}/{projectname}/{route} GET User-defined route
/library/{path} GET Library asset (resolves to current user's library)
/~public/{path} GET Admin public library

6.2 Protected API Endpoints (Session or API Key)

Endpoint Method Description
/api/db/find POST Query documents
/api/db/insert POST Insert document
/api/db/update POST Update documents
/api/db/delete POST Delete documents
/api/storage/list GET List files
/api/storage/upload POST Upload file
/api/storage/download GET Download file
/api/storage/delete POST Delete file
/api/storage/status GET Storage usage
/api/lib/list GET List library files
/api/lib/upload POST Upload to library
/api/lib/delete POST Delete from library
/api/lib/status GET Library usage
/api/secrets/get POST Get secret value (owner/admin only)
/api/proxy/{route}  *  Proxy to external API

6.3 Dashboard API Endpoints (Session Required)

Endpoint Method Description
/api/projects CRUD Project management
/api/routes CRUD Route configuration
/api/api-endpoints CRUD API endpoint enable/disable
/api/roles CRUD Role and permission management
/api/visitors CRUD Visitor account management
/api/secrets CRUD Secret management
/api/cron CRUD Cron task configuration
/api/webhooks CRUD Webhook configuration
/api/domains CRUD Domain registration
/api/export/{feature} GET Export configuration
/api/export/all GET Export full project (ZIP)
/api/import/{feature} POST Import configuration
/api/import/all POST Import full project (ZIP)

6.4 Admin API Endpoints (Admin Role Required)

Endpoint Method Description
/admin/api/users CRUD User management
/admin/api/projects CRUD Project management (all)
/admin/api/system-configs CRUD System configuration
/admin/api/global-cron CRUD Global cron task management
/admin/api/stats GET Anonymous aggregated statistics

---

7. Security

7.1 Authentication

· Platform: Username + password (bcrypt hashed) + Math CAPTCHA.
· Visitor: Username + password (bcrypt hashed) per project.
· API Key: UUID (bcrypt hashed) for agent access.

7.2 Authorization

· Role-based access control (RBAC) per project.
· Pre-defined roles: Owner, Admin, Member, Guest.
· Custom roles with granular permissions.
· Route-level authorization (requires_auth, required_role).

7.3 Data Encryption

· Secrets: AES-256-GCM encryption at rest.
· Passwords: bcrypt (12 rounds).
· SSL/TLS: Let's Encrypt for all domains (including user custom domains).

7.4 Input Validation

· All API inputs validated against JSON schemas.
· SQL injection prevention: parameterized queries (Dapper).
· Path traversal prevention: sanitize .., absolute paths.

7.5 Rate Limiting

· Per-session and per-IP rate limiting.
· PostgreSQL-backed for persistence.

7.6 Session Security

· HttpOnly, Secure, SameSite=Lax cookies.
· Session stored in PostgreSQL (not memory).
· Session expiry: 20 minutes sliding.

7.7 Cross-Project Isolation

· Projects are isolated by project_id in all database queries.
· Static assets: Referer validation prevents cross-project asset loading.
· Library: Scoped to user (all projects under same user share).

7.8 Anti-CDN Hotlinking

· All /static/* and /library/* requests validated against Referer/Origin.
· Blocked if referer is from external domain.
· Allowed: localme.com, empty (direct), search engine bots.

---

8. Performance & Optimization

8.1 Caching

· File Metadata: Cached in IMemoryCache (TTL: 5 minutes).
· Static Assets: Cache-Control: public, max-age=86400 (1 day).
· HTML: Cache-Control: no-cache, no-store, private (visit counting).

8.2 Database Optimization

· GIN indexes on JSONB columns for project_data.
· Partitioned visit_logs table by month.
· Connection pooling (Npgsql).
· Read replicas: Not applicable (single server).

8.3 File Storage

· Brotli compression for all stored files.
· Streaming for downloads (no byte[] loading).
· Minification on save (HTML/CSS/JS).

8.4 Concurrency

· Write locks: SemaphoreSlim(1,1) per project for all write operations.
· Reads: Lock-free, parallel.
· SQLite: Not applicable (dropped).

---

9. Deployment & Operations

9.1 Deployment Architecture

· Single server (Ubuntu 24.04 LTS).
· NGINX as reverse proxy (SSL termination, static asset caching).
· Kestrel (ASP.NET Core) for backend API.
· Next.js standalone output for frontend.
· PostgreSQL 18.4 as database.

9.2 Process Management

· systemd services:
  · mvp-backend.service (.NET 10)
  · mvp-frontend.service (Next.js)
  · mvp-postgres.service (PostgreSQL)
  · mvp-nginx.service (NGINX)

9.3 Backup Strategy

· User-initiated: Export via dashboard (ZIP).
· System: PostgreSQL daily pg_dump (retention: 30 days).
· File system: Not backed up by platform (users export manually).

9.4 Logging

· Serilog with file sink (/var/log/mvp/).
· Log levels: Information (production), Debug (development).
· No external logging agents (per requirement).

9.5 Monitoring

· Health check endpoint: GET /health (returns 200 if all services are healthy).
· No external monitoring tools (per requirement).

---

10. System Configurations (Admin-Editable)

All configurable values stored in system_configs table:

```json
{
  "storage": {
    "default_user_cap_bytes": 5242880,
    "max_user_cap_bytes": 1073741824,
    "library_bonus_bytes": 5242880,
    "max_upload_size_bytes": 10485760
  },
  "visits": {
    "free_visits_per_month": 100,
    "dedupe_window_seconds": 300
  },
  "rate_limits": {
    "public_requests_per_minute": 60,
    "authenticated_requests_per_minute": 300,
    "admin_requests_per_minute": 600,
    "api_key_requests_per_minute": 600,
    "asset_requests_per_minute": 1000,
    "library_requests_per_minute": 1000,
    "ip_fallback_requests_per_minute": 30
  },
  "auth": {
    "max_login_attempts": 5,
    "lockout_minutes": 5,
    "session_timeout_minutes": 20,
    "api_key_expiry_days": 90
  },
  "cron": {
    "max_concurrent_jobs": 5,
    "timeout_seconds": 60,
    "min_interval_minutes": 30
  },
  "webhooks": {
    "rate_limit_per_minute": 100,
    "max_webhooks_per_project": 20,
    "timeout_seconds": 30
  },
  "retention": {
    "free_log_retention_months": 3,
    "paid_log_retention_months": 24,
    "rate_limit_retention_days": 7
  },
  "proxy": {
    "default_timeout_seconds": 30,
    "max_timeout_seconds": 60
  }
}
```

---

11. File System Structure

```
/var/mvp/
├── storage/
│   ├── {userId}/
│   │   ├── {projectId}/
│   │   │   ├── index.html
│   │   │   ├── 404.html
│   │   │   ├── manifest.json
│   │   │   ├── sw.js
│   │   │   ├── login.html (optional)
│   │   │   └── ... (user files)
│   │   └── library/
│   │       └── ... (library assets)
│   └── temp/
│       └── uploads/ (temporary upload files)
├── logs/
│   ├── backend.log
│   └── frontend.log
├── ssl/
│   └── {domain}/
│       ├── certificate.pem
│       └── private_key.pem
└── backups/
    └── postgres/
        └── dump_YYYY-MM-DD.sql
```

---

12. PWA Support

On Project Creation:

· manifest.json (default: name = project name, start_url = /, display = standalone).
· sw.js (basic service worker caching index.html and static assets).
· icons/ directory with placeholder icons.

User Customization:

· User can edit or delete these files.
· If sw.js is deleted, PWA support is disabled.
· No special middleware — files are served as-is.

---

13. Custom 404 Page

· If 404.html exists in project root → served for 404 errors (HTTP status 404).
· If not → platform's generic 404 page.

---

14. Watermark

Injection: Server-side middleware injects a thin fixed-position watermark before </body> tag.

```html
<div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(0,0,0,0.7);color:#fff;text-align:center;font-size:12px;padding:4px 0;">
    Hosted on <a href="https://mvp.com" style="color:#fff;text-decoration:underline;">MVP Platform</a>
</div>
```

Enforcement:

· Injected by .NET middleware (not user-editable).
· CSS: position: fixed; bottom: 0; z-index: 9999;.
· Removal attempt via JS can be monitored (optional).

---

15. Error Codes

HTTP Status Description
200 OK
201 Created
400 Bad Request (validation failed)
401 Unauthorized (not authenticated)
403 Forbidden (authenticated but insufficient permissions)
404 Not Found
429 Too Many Requests (rate limit exceeded)
500 Internal Server Error

---

16. Dependencies & Packages

16.1 Backend (.NET 10)

```xml
<PackageReference Include="Npgsql" Version="9.0.0" />
<PackageReference Include="Dapper" Version="2.1.35" />
<PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.0.0" />
<PackageReference Include="Quartz" Version="4.0.0" />
<PackageReference Include="Quartz.Extensions.Hosting" Version="4.0.0" />
<PackageReference Include="PuppeteerSharp" Version="20.0.0" />
<PackageReference Include="Certes" Version="3.0.0" />
<PackageReference Include="Serilog" Version="4.0.0" />
<PackageReference Include="Serilog.Sinks.File" Version="6.0.0" />
<PackageReference Include="Serilog.Sinks.Console" Version="6.0.0" />
<PackageReference Include="NUglify" Version="1.21.0" />
<PackageReference Include="Yarp.ReverseProxy" Version="2.2.0" />
<PackageReference Include="System.IO.Compression.ZipFile" Version="4.3.0" />
<PackageReference Include="System.Text.Encodings.Web" Version="8.0.0" />
```

16.2 Frontend (Next.js 16.2.10)

```json
{
  "dependencies": {
    "next": "16.2.10",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "typescript": "5.8.0",
    "tailwindcss": "4.0.0",
    "zod": "3.24.0",
    "zustand": "5.0.0",
    "@hookform/resolvers": "3.9.0",
    "react-hook-form": "7.53.0",
    "shadcn-ui": "latest"
  }
}
```

---

17. Environment Variables

17.1 Backend (.NET)

```
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://localhost:5000

# Database
POSTGRES_CONNECTION_STRING=Host=localhost;Port=5432;Database=mvp;Username=mvp_user;Password=***

# JWT
JWT_SECRET=***
JWT_ISSUER=mvp-platform
JWT_AUDIENCE=mvp-platform

# Encryption (Secrets)
ENCRYPTION_KEY=*** (32-byte AES key)

# Storage
STORAGE_ROOT=/var/mvp/storage

# SSL (Certes)
SSL_EMAIL=admin@mvp.com
SSL_STORAGE_PATH=/var/mvp/ssl

# Logging
LOG_PATH=/var/mvp/logs/backend.log
```

17.2 Frontend (Next.js)

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

18. Development Guidelines

18.1 Code Organization (Backend)

```
/src/
├── Modules/
│   ├── Database/
│   │   ├── DatabaseService.cs
│   │   ├── IDatabaseService.cs
│   │   └── Models/
│   ├── Storage/
│   │   ├── StorageService.cs
│   │   ├── IStorageService.cs
│   │   └── Providers/
│   │       └── LocalDiskStorageProvider.cs
│   ├── Routing/
│   │   ├── RoutingService.cs
│   │   ├── IRoutingService.cs
│   │   └── RouteResolver.cs
│   ├── Auth/
│   │   ├── AuthService.cs
│   │   ├── IAuthService.cs
│   │   ├── JwtService.cs
│   │   └── CaptchaService.cs
│   ├── Authorization/
│   │   ├── AuthorizationService.cs
│   │   └── IAuthorizationService.cs
│   ├── Secrets/
│   │   ├── SecretsService.cs
│   │   ├── ISecretsService.cs
│   │   └── EncryptionService.cs
│   ├── Proxy/
│   │   ├── ProxyService.cs
│   │   └── IProxyService.cs
│   ├── Webhooks/
│   │   ├── WebhookService.cs
│   │   ├── IWebhookService.cs
│   │   └── WebhookDispatcher.cs
│   ├── Cron/
│   │   ├── CronService.cs
│   │   ├── ICronService.cs
│   │   └── Jobs/
│   │       ├── CleanExpiredSessionsJob.cs
│   │       ├── CleanOldLogsJob.cs
│   │       ├── GenerateDailyStatsJob.cs
│   │       ├── SendDailySummaryWebhookJob.cs
│   │       └── CleanOrphanedUploadsJob.cs
│   ├── DNS/
│   │   ├── DnsService.cs
│   │   ├── IDnsService.cs
│   │   └── SslService.cs
│   ├── ImportExport/
│   │   ├── ImportExportService.cs
│   │   └── IImportExportService.cs
│   ├── RateLimiting/
│   │   ├── RateLimiter.cs
│   │   └── IRateLimiter.cs
│   └── Session/
│       ├── SessionService.cs
│       └── ISessionService.cs
├── Middleware/
│   ├── AuthenticationMiddleware.cs
│   ├── RateLimitingMiddleware.cs
│   ├── RoutingMiddleware.cs
│   ├── WatermarkMiddleware.cs
│   └── SecurityHeadersMiddleware.cs
├── Filters/
│   ├── ValidationFilter.cs
│   └── AuthorizationFilter.cs
├── Models/
│   ├── Requests/
│   └── Responses/
├── Data/
│   ├── Migrations/
│   └── Repositories/
├── Program.cs
└── appsettings.json
```

18.2 Code Organization (Frontend)

```
/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── admin/
│   │   └── page.tsx
│   └── user/
│       ├── page.tsx
│       └── [projectId]/
│           ├── page.tsx
│           ├── routing/
│           ├── storage/
│           ├── library/
│           ├── database/
│           ├── auth/
│           ├── cron/
│           ├── webhooks/
│           ├── domains/
│           └── import-export/
├── api/
│   └── (proxy routes to backend)
├── components/
│   ├── ui/ (shadcn)
│   ├── forms/
│   └── layout/
├── lib/
│   ├── api/
│   ├── store/
│   └── validations/
└── styles/
    └── globals.css
```

---

19. Glossary

Term Definition
BaaS Backend-as-a-Service
MVP Minimum Viable Product
JSONB PostgreSQL binary JSON data type
JWT JSON Web Token
RBAC Role-Based Access Control
ACME Automated Certificate Management Environment
SNI Server Name Indication
GIN Generalized Inverted Index (PostgreSQL)
LTS Long-Term Support

---

This document constitutes the complete, final, and unalterable source of truth for the Minimum Viable Product (MVP) Platform. All development, testing, and deployment activities must adhere strictly to these specifications. No further gaps remain.

Document generated on 2026-07-20.
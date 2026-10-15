# Master Product & Technical Specification Document (SSOT)

**Document Version:** 1.0.0-FINAL (Pure .NET 10 Stack — LocalMe)

**Product Category:** Unified Backend-as-a-Service (BaaS) & Edge Platform-as-a-Service (PaaS)

**Primary Market:** Iran-Native Ecosystem (with Full Global & Cross-Border Compatibility)

**Target Personas:** Frontend Web Engineers & Mobile (iOS, Android, Flutter, React Native) Developers operating without a dedicated Backend or DevOps team

**Primary Domain:** `https://localme.ir`

**Primary Repository:** `https://github.com/LocalMeProject/localme-dotnet`

---

## 0. Foundational Runtime Decisions (v1.0)

This version supersedes v1.0. Every runtime component is consolidated onto **.NET 10 + PostgreSQL 18.1 + Redis 7/8** with zero external runtime binaries (no Rust, no Go, no Envoy, no NATS, no Dragonfly, no ClickHouse, no standalone V8 host, no EMQX, no libvips, no PgBouncer). This is a deliberate trade-off: absolute operational simplicity, single-language maintainability, single-container deployability, and full compatibility with shared/managed Iranian hosting providers.

### 0.1 Engine Substitution Mapping

| v1.0 External Engine | v1.0 Pure .NET 10 + PG 18.1 + Redis Replacement |
| --- | --- |
| Envoy Edge Proxy | **YARP (`Yarp.ReverseProxy`)** + **Kestrel Dynamic SNI** + **LettuceEncrypt** (in-process ACME SSL) |
| PostgREST + PgBouncer | **`NpgsqlDataSource`** (native multiplexing/pooling) + custom **ASP.NET Core 10 Dynamic SQL Endpoint Middleware** (C# 14 `Span<T>` zero-alloc JSON streaming directly from `NpgsqlDataReader` to `PipeWriter`) |
| Rust `deno_core` (V8) | **`Jint` 4.x** (Managed C# JS Engine) — default for shared hosting. **`Microsoft.ClearScript.V8`** — opt-in for dedicated nodes. |
| NATS JetStream | **Redis Streams (`XADD` / `XREADGROUP`)** via `StackExchange.Redis` for durable queues, consumer groups, and workflow timers |
| Dragonfly Cache/Locks | **Redis 7/8** with pre-loaded **Lua scripts** for atomic GCRA rate limiting, OTP storage, and fenced Redlock mutexes |
| Rust WS + EMQX Broker | **ASP.NET Core SignalR** (with Redis backplane) + **`MQTTnet.AspNetCore`** (hosts MQTT v5 over WebSockets on Kestrel :443) |
| ImgProxy + TUS Proxy | **`SixLabors.ImageSharp.Web`** + **`tusdotnet`** middleware in the ASP.NET Core pipeline |
| ClickHouse (OLAP) | **PostgreSQL 18 Declarative Partitioning + BRIN Indexes + Async I/O** (native `uuidv7()`, virtual generated columns) |
| CoreDNS + etcd | **`ARSoft.Tools.Net`**-based authoritative DNS service reading project records from the `localme` database via Redis pub/sub invalidation |

### 0.2 The Four Reality-Check Directives

These are non-negotiable architectural constraints driven by the target hosting environment (`runflare.com` managed Postgres + Redis):

#### Directive 1 — No `pgoutput` Logical Replication

Managed Postgres rarely grants `REPLICATION` role or `wal_level = logical` and enforces aggressive connection caps. **WAL slot CDC is forbidden.** Real-time streaming instead uses:

- **Application-Level Write Interception** at the Dynamic SQL Middleware layer: every `INSERT`/`UPDATE`/`DELETE` routed through the platform API emits a structured change event to a Redis Stream (`prj_{id}:cdc:{schema}.{table}`).
- **PostgreSQL `LISTEN / NOTIFY`** triggers as a secondary safety net for mutations performed by direct SQL or by tenant-side triggers. A single persistent `NpgsqlConnection` per PG node demultiplexes `NOTIFY` payloads to Redis Streams.
- **Polling Fallback**: tables opted into `RTDAAS` also maintain `_server_version BIGINT` and are polled by the sync engine at a configurable interval (default 250ms) if `LISTEN` channel pressure is high.

#### Directive 2 — Single Database Isolation via Schemas

The connection string targets one physical database named **`localme`**. All schemas are logically partitioned:

- `control_plane.*` → Platform tables (Organizations, Projects, Capabilities, Primitives, Billing, Web Deployments).
- `prj_{project_slug}.*` → Isolated tenant schemas (auth, finance, workflows, push, storage, user tables). Row-Level Security is enabled by default on every tenant table.
- `billing.*` → Aggregated metering rollups.
- `analytics.*` → ClickHouse-replacement analytical event tables (PG 18 declarative partitioning).

Cross-schema leakage is prevented via per-project `SET LOCAL search_path = prj_{slug}, auth` inside every Dynamic SQL transaction, plus a per-project `role_prj_{slug}` PostgreSQL role with `NOINHERIT` and schema-scoped grants.

#### Directive 3 — Jint by Default, ClearScript.V8 Opt-In

`Microsoft.ClearScript.V8` embeds native V8 (`libClearScriptV8.so`), bypasses the .NET GC, and can trigger container OOM kills on shared hosting. **Jint 4.x is the default engine** because:

- 100% managed .NET memory — GC-visible and safe.
- `Options.LimitMemory(16_000_000)` and `Options.TimeoutInterval(TimeSpan.FromSeconds(5))` are enforced per invocation.
- Ideal for the SMS/KYC/Webhook dispatch templates (small scripts, cold-start tolerant, deterministic).
- Runtimes needing heavy CPU or modern V8 features (WASM, top-level await) can opt into `CLEARSCRIPT_V8_ISOLATE` primitive on a dedicated node — enforced by a feature flag on the project.

#### Directive 4 — Mandatory Blob Storage Adapter Layer

Tenant files, APK releases, and deployed SPA bundles **must not** live in Postgres `BYTEA` or Redis. The platform ships a **`IBlobStorageAdapter`** abstraction with the following implementations:

1. **`RunflareBlobAdapter`** (default) — Runflare.com S3-compatible Blob Storage.
2. **`ArvanS3Adapter`** — ArvanCloud Object Storage (Iranian).
3. **`ParsPackS3Adapter`** — ParsPack Object Storage (Iranian).
4. **`MinioS3Adapter`** — self-hosted MinIO for on-prem / air-gapped deployments.
5. **`AwsS3Adapter`** / **`CloudflareR2Adapter`** — international fallbacks.
6. **`LocalDiskAdapter`** — bind-mounted persistent volume (development / single-node deployments only).

Adapter selection is per-project via `projects.storage_adapter_key`. All adapters implement: `PutObjectAsync`, `GetObjectAsync`, `DeleteObjectAsync`, `HeadObjectAsync`, `CreatePresignedPutUrlAsync`, `CreatePresignedGetUrlAsync`, `ListAsync`, and `InitiateMultipartUploadAsync`. This means migrating a project from Runflare to ArvanCloud is a single configuration change plus a background data-copy job.

---

## 1. Executive Overview & System Identity

### 1.1 Core Objective

LocalMe eliminates backend and infrastructure engineering for web and mobile product teams. A developer creates a project, receives an instant pre-configured static subdomain (`{project-slug}.localme.ir`) or binds a custom domain, deploys their frontend web bundle or connects their mobile client SDK, and enables the exact backend capabilities their product requires.

Behind the scenes, an automated **Directed Acyclic Graph (DAG) Dependency Matrix Engine** provisions, wires, isolates, and scales the underlying infrastructure primitives **inside a single .NET 10 process group** (backed by PostgreSQL 18.1 and Redis 7/8).

### 1.2 Iran-Native & Global Dual-Architecture

The system natively solves the hardest operational bottlenecks of the Iranian software ecosystem while remaining 100% compatible with international standards:

1. **Regulatory & Banking Compliance (e-Namad & Shaparak):** Built-in headless compliance responders (`enamad.txt`, dynamic meta injection, fallback compliant storefront pages) combined with a **Static Egress NAT Gateway Pool** so outbound server-to-server calls to Iranian PSPs (Zarinpal, Behpardakht, SEP, Parsian) always originate from whitelisted domestic static IPs.
2. **Managed IPG to Mobile Deep-Link Bridge:** Handles browser-to-server bank callbacks, verifies transactions server-side, updates an atomic **Iranian Rial (`IRR`) `BIGINT` ledger**, and redirects the mobile user back into their native app via OS deep links (`myapp://`) or Universal/App Links.
3. **Domestic App Store In-App Purchases (IAP):** Native server-to-server purchase token validation and entitlement tracking for **Cafe Bazaar (Poolkey)** and **Myket**, alongside Apple StoreKit 2 and Google Play Billing.
4. **Network Isolation Resiliency (NIN / Intranet):** A **Dual-Mode Push Notification Engine** that dispatches via FCM/APNs globally while simultaneously maintaining an ultra-lightweight domestic **MQTT-over-WebSocket** channel (`MQTTnet.AspNetCore`) so Android and Web notifications arrive in real time even during complete international internet cutoffs.
5. **Template-Driven Extensibility:** A **Jint**-hosted JavaScript runtime with a curated library of dispatch hooks (MeliPayamak, Kavenegar, FarazSMS, Shahkar/KYC aggregators, generic HMAC webhook verifier) and an AES-256-GCM-encrypted Secrets Vault.

### 1.3 Architectural Tenets

* **Control Plane as a Modular Monolith:** A single ASP.NET Core 10 solution using strict Domain-Driven Design (DDD) and Test-Driven Development (TDD). Bounded contexts are C# projects inside one solution; they are not microservices and do not communicate via gRPC.
* **Data Plane as In-Process ASP.NET Core Middleware:** Data-plane capabilities (Dynamic SQL API, SignalR realtime, MQTT broker, TUS uploads, ImageSharp rendering, Jint functions, workflow orchestrator, IPG bridge, IAP validator, compliance responder) are all ASP.NET Core endpoints mounted under `/_baas/v1/*` and served by the same Kestrel process that hosts the Control Plane's admin API.
* **Process Separation by Role (Not by Service):** Deployments run one or more *node roles*: `edge`, `control`, `data`, `worker`. All roles run the same binary, differentiated by configuration.
* **Hot-Path Decoupling:** Control Plane writes are transactional; when the Control Plane's mutation pipeline is under maintenance, the read-only and pre-provisioned Data Plane surface (`/_baas/v1/*`) keeps serving traffic from cached routing tables in Redis.

---

## 2. Master System Architecture: Control Plane & Data Plane

```
====================================================================================================
                                    GLOBAL & DOMESTIC EDGE TIER
====================================================================================================
  [ Client SDKs: Web / iOS / Android ]         [ External Webhooks: Shaparak / Bazaar / Myket ]
                   |                                                   |
                   +-------------------------+-------------------------+
                                             |
                                             v
                     +-----------------------------------------------+
                     |   Kestrel (ASP.NET Core 10) — Edge Node Role  |
                     |   - Dynamic SNI (wildcard + custom domains)   |
                     |   - LettuceEncrypt in-process ACME            |
                     |   - YARP Reverse Proxy routing table          |
                     |   - Local Ed25519 JWKS JWT verification       |
                     |   - Domestic vs International IP tagging      |
                     +---+---------------+---------------+-------+---+
                         |               |               |       |
       +-----------------+               |               |       +-----------------+
       | (Compliance/Root)               | (/_baas/v1/*) | (WS/MQTT)               | (Static Assets)
       v                                 v               v                         v
+--------------------+   +-----------------------+   +--------------------+   +--------------------+
| Compliance Engine  |   |   TENANT DATA PLANE   |   | REAL-TIME & PUSH   |   | FRONTEND HOSTING   |
| - /enamad.txt      |   | - Dynamic SQL API     |   | - SignalR Hub      |   | - S3 VFS (adapter) |
| - /.well-known/*   |   | - Jint Function Host  |   | - MQTTnet Broker   |   | - Immutable Builds |
| - Fallback Store   |   | - TUS & ImageSharp    |   | - FCM/APNs Relay   |   | - Edge Memory Cache|
+--------------------+   +-----------+-----------+   +---------+----------+   +--------------------+
                                     |                         |
                                     +------------+------------+
                                                  |
                                                  v
====================================================================================================
                                  SHARED & ISOLATED STORAGE ENGINES
====================================================================================================
  +--------------------------------+  +--------------------------------+  +----------------------------+
  | PostgreSQL 18.1                |  | Redis 7/8                      |  | Blob Storage Adapter Layer |
  | (single database: "localme")   |  | (logical namespace: "localme") |  | - RunflareBlob (default)   |
  | - schema: control_plane        |  | - Streams (queues/workflows)   |  | - ArvanS3 / ParsPackS3     |
  | - schema: prj_{slug}           |  | - KV/Locks/GCRA rate limits    |  | - MinIO / AWS S3 / R2      |
  | - schema: billing / analytics  |  | - SignalR backplane            |  | - LocalDisk (dev only)     |
  | - RLS + BRIN + uuidv7          |  | - Distributed cache            |  |                            |
  +--------------------------------+  +--------------------------------+  +----------------------------+
                                                  |
                                                  v
                     +-----------------------------------------------+
                     |        Static Egress NAT Gateway Pool         |
                     |  - Fixed Whitelisted Iranian IPs for PSP/SMS  |
                     +-----------------------------------------------+

====================================================================================================
                         PLATFORM CONTROL PLANE (DDD — one .NET solution)
====================================================================================================
  +-----------------------------------------------------------------------------------------------+
  | Modular Monolith: [IdentityContext] [ProjectContext] [OrchestrationDAGContext] [BillingContext]|
  |   Hosted as ASP.NET Core 10 node role: "control"                                              |
  +-----------------------------------------------------------------------------------------------+

====================================================================================================
                                 NODE ROLES (same binary, different config)
====================================================================================================
  [ edge ]      Kestrel + YARP + LettuceEncrypt + Compliance + Frontend edge cache
  [ control ]   Control Plane modular monolith + project orchestration
  [ data ]      Dynamic SQL API + SignalR + MQTTnet + TUS + ImageSharp + Jint function host
  [ worker ]    Redis Streams consumers (workflows, CDC, heavy jobs, billing rollups)
```

### 2.1 Control Plane Bounded Contexts (DDD)

1. **`IdentityContext`** — Platform developer accounts, 2FA, organization memberships, RBAC (Owner, Admin, Developer, Billing), CLI personal access tokens.
2. **`ProjectContext`** — Project lifecycle, AES-256-GCM Secrets Vault, custom domain bindings, compliance metadata, storage adapter selection, frontend deployment artifacts.
3. **`OrchestrationDAGContext`** — The **Dependency Matrix Engine**. Evaluates service enable/disable mutations, computes reference counts across infrastructure primitives, and executes idempotent provisioning/deprovisioning drivers **entirely within the .NET process** (schema creation, Redis key namespace reservation, YARP route registration, DNS record write, Jint isolate pool warm-up, storage bucket/prefix reservation, etc.).
4. **`BillingContext`** — Ingests aggregated usage telemetry from PG `billing.usage_ledger_raw`, maintains prepaid organization **Rial (`IRR`)** wallets, enforces project spend caps, and signals the Edge node to throttle or suspend projects upon balance exhaustion.

### 2.2 Multi-Tenant Data Plane Isolation Matrix

| Infrastructure Primitive | Starter / Standard Isolation | Enterprise Dedicated Isolation |
| --- | --- | --- |
| **PostgreSQL (OLTP)** | Schema-per-tenant (`prj_{slug}`) with strict role + RLS boundaries on the shared `localme` database | Dedicated PostgreSQL instance / Patroni HA cluster |
| **Npgsql Connection Pool** | Shared `NpgsqlDataSource` per PG node, per-tenant `SET LOCAL search_path`, statement timeouts enforced by `SET LOCAL` | Dedicated `NpgsqlDataSource` |
| **Redis (Cache, Locks, Streams)** | Key-prefix namespace `localme:prj_{id}:*` enforced by a wrapper `IDatabase` + memory quota via `maxmemory-policy` | Dedicated Redis instance or logical DB |
| **Redis Streams (Queues)** | Per-project stream keys (`localme:prj_{id}:stream:*`) with TTL + consumer group caps | Dedicated Redis instance |
| **Analytical Partitions (PG 18)** | Shared `analytics.tenant_events` table, `PARTITION BY LIST (project_id)` | Dedicated partition set + dedicated tablespace |
| **Jint Isolate Compute** | Shared `JintEnginePool` with per-invocation memory (16MB) + CPU timeout (5s) caps | Dedicated `JintEnginePool` or `ClearScript.V8` worker node |
| **Object & Frontend Storage** | Prefix isolation `/{project_id}/*` on the configured storage adapter | Dedicated bucket or Bring-Your-Own-S3 |

---

## 3. Complete Service Dependency Matrix (DAG Engine)

Developers toggle **User-Facing Capabilities**. The DAG Engine resolves and provisions all required **Internal Infrastructure Primitives** using atomic reference counting (`ref_count`).

### 3.1 Master Capability-to-Primitive Resolution Table

| User-Facing Capability | Code | Activated Internal Infrastructure Primitives |
| --- | --- | --- |
| **Core Project Foundation** | `BASE` | `DNS_SUBDOMAIN`, `YARP_ROUTE`, `COMPLIANCE_RESPONDER`, `TELEMETRY_METER` |
| **Relational Database & API** | `BAAS_DB` | `PG_TENANT_SCHEMA`, `NPGSQL_POOL`, `DYNAMIC_SQL_ROUTE` |
| **Authentication (IDaaS)** | `IDAAS` | `BAAS_DB`, `REDIS_KV`, `JINT_ISOLATE`, `SECRET_VAULT`, `STATIC_EGRESS_NAT` |
| **Real-Time PubSub (RTaaS)** | `RTAAS` | `BAAS_DB`, `PG_LISTEN_NOTIFY`, `REDIS_STREAMS`, `SIGNALR_GATEWAY` |
| **Offline Data Sync (RTDaaS)** | `RTDAAS` | `RTAAS`, `BAAS_DB` (HLC shadow columns + tombstone ledger) |
| **Edge Compute & Scripts** | `COMPUTE_EDGE` | `JINT_ISOLATE` (or `CLEARSCRIPT_V8_ISOLATE`), `SECRET_VAULT`, `STATIC_EGRESS_NAT` |
| **Managed IPG & IRR Ledger** | `FIN_IPG` | `BAAS_DB` (`IRR` ledger), `COMPUTE_EDGE`, `STATIC_EGRESS_NAT`, `COMPLIANCE_RESPONDER` |
| **Mobile IAP Validator** | `FIN_IAP` | `BAAS_DB` (entitlements schema), `COMPUTE_EDGE`, `REDIS_KV`, `STATIC_EGRESS_NAT` |
| **Blob & Media Storage** | `STORAGE_BLOB` | `BAAS_DB` (storage schema), `BLOB_STORAGE_ADAPTER`, `TUSDOTNET_PROXY`, `IMAGESHARP_PROXY` |
| **Event Streaming (EDAaaS)** | `EDA_STREAM` | `REDIS_STREAMS` (persistent streams, consumer groups, DLQ) |
| **Durable Workflows** | `WORKFLOW_DUR` | `REDIS_STREAMS`, `BAAS_DB` (workflow journal), `JINT_ISOLATE` |
| **Heavy Compute Pipeline** | `COMPUTE_HEAVY` | `REDIS_STREAMS`, `STORAGE_BLOB`, `HEAVY_WORKER_POOL` |
| **Cache, Locks & Rate Limits** | `CACHE_LOCK` | `REDIS_KV` (KV, Lua Redlock, GCRA rate limiter) |
| **Analytical Engine (OLAP)** | `OLAP_ENGINE` | `PG_ANALYTICS_PART`, `PG_LISTEN_NOTIFY` (CDC sink), `REDIS_STREAMS` |
| **Dual-Mode Push Engine** | `PUSH_ENGINE` | `BAAS_DB` (device registry), `REDIS_STREAMS`, `MQTTNET_BROKER`, `FCM_APNS_ADAPTER` |
| **Mobile Ops & App Updater** | `MOBILE_OPS` | `REDIS_KV`, `STORAGE_BLOB` (APK hosting), `COMPLIANCE_RESPONDER` (AssetLinks/AASA) |
| **Frontend Web Hosting** | `HOSTING_WEB` | `BLOB_STORAGE_ADAPTER` (static VFS), `YARP_ROUTE` (SPA/CDN mount), `EDGE_CACHE`, `LETTUCEENCRYPT_SSL` |

### 3.2 DAG Lifecycle & Reference Counting Rules

1. **Enable Operation:** When capability $C$ is enabled, the resolver computes the transitive closure of required primitives $P_1 \dots P_n$. For each primitive:
   * If not present in `control_plane.project_primitives`, insert with `ref_count = 1`, transition `PENDING` → `PROVISIONING`, execute the driver, and mark `HEALTHY`.
   * If already present and `HEALTHY`, increment `ref_count = ref_count + 1` atomically.

2. **Disable Operation:** When capability $C$ is disabled, decrement `ref_count` on each dependent primitive. Only primitives reaching `ref_count == 0` transition to `DEPROVISIONING` (with configurable data retention grace periods for stateful primitives).

3. **Drivers are Idempotent:** Every provisioning driver runs inside a per-project distributed lock (`localme:prj_{id}:lock:dag:{primitive}`) acquired via Redis SET NX PX. Failed provisioning leaves the primitive in `DEGRADED` and retries with exponential backoff.

---

## 4. Edge Networking, DNS, Hosting & Iran Regulatory Layer

### 4.1 Authoritative Dynamic DNS (`DNS_SUBDOMAIN`)

* **Engine:** A .NET authoritative DNS service built on **`ARSoft.Tools.Net`** reading `control_plane.projects` via `NpgsqlDataSource`, with an in-memory route cache invalidated by Redis pub/sub channel `localme:dns:invalidate`.
* **Instant Provisioning:** Creating project `digikala-clone` writes a row to `control_plane.projects` and publishes to `localme:dns:invalidate`. Every DNS node refreshes its in-memory `{slug} → EdgeAnycastIP` map within < 100ms. No zone-file reload, no `etcd`, no external DNS dependency.
* **Custom Domains:** Supports apex domains (`myshop.ir` via ALIAS/ANAME or A records) and subdomains (`app.myshop.ir` via CNAME to `{slug}.localme.ir`).
* **Alternative Deployment Mode:** The same route table is exported in BIND/`CoreDNS` zone-file format for operators who prefer to run an external authoritative DNS with an `AXFR`-style sync (documented in the deployment guide).

### 4.2 Kestrel + YARP Edge Gateway & Request Routing (`YARP_ROUTE`)

Every incoming request to `{slug}.localme.ir` or a bound custom domain is evaluated by **YARP's** route matcher (config sourced dynamically from `control_plane.projects` and refreshed via Redis pub/sub) in strict priority order:

| Priority | Path / Match Rule | Target Upstream Service |
| --- | --- | --- |
| **1** | `GET /enamad.txt`, `GET /samandehi.txt` | **Compliance Responder** (Dynamic plain-text verification payload) |
| **2** | `GET /.well-known/assetlinks.json`, `GET /.well-known/apple-app-site-association` | **Compliance Responder** (Mobile App Links & Universal Links JSON) |
| **3** | `/_baas/v1/auth/*` | **IDaaS Auth Engine** (in-process middleware) |
| **4** | `/_baas/v1/rest/*`, `/_baas/v1/graphql` | **Dynamic SQL API** (in-process middleware) |
| **5** | `/_baas/v1/realtime` (WebSocket Upgrade) | **SignalR Hub** (in-process middleware) |
| **6** | `/_baas/v1/mqtt` (WebSocket Upgrade) | **MQTTnet Broker** (in-process middleware) |
| **7** | `/_baas/v1/storage/tus/*` | **tusdotnet** Resumable Upload Middleware |
| **8** | `/_baas/v1/storage/render/*` | **ImageSharp.Web** On-the-Fly Media Transformer |
| **9** | `/_baas/v1/storage/object/*` | **Blob Storage Adapter Proxy** (Runflare/Arvan/etc.) |
| **10** | `/_baas/v1/functions/*`, `/_baas/v1/workflows/*` | **Jint Function Host & Workflow Runner** |
| **11** | `/_baas/v1/pay/*`, `/_baas/v1/iap/*` | **Managed IPG Callback Bridge & IAP Validator** |
| **12** | `/_baas/v1/sync/*`, `/_baas/v1/analytics/*`, `/_baas/v1/config` | **Sync Engine, PG Analytics Ingestion Gateway, Remote Config** |
| **13** | `/*` (Catch-All when `HOSTING_WEB` is enabled) | **Frontend Web Hosting VFS Proxy** (serves deployed SPA/static bundle with `<meta name="enamad">` auto-injection) |
| **14** | `/*` (Catch-All when `HOSTING_WEB` is disabled) | **Compliance Responder** (serves Compliant e-Namad Stub Storefront HTML) |

**Custom-domain SSL:** `LettuceEncrypt` runs an in-process ACME client against Let's Encrypt, writes `PFX` files into the local encrypted volume, and hot-reloads the Kestrel `ServerCertificateSelector` — no external cert-manager, no Nginx.

### 4.3 Headless Compliance Responder (`COMPLIANCE_RESPONDER`)

Ensures mobile-only or backend-first projects pass both automated e-Namad crawlers and manual human audits:

* **Automated Meta Injection:** Even when a developer deploys their own React/Vue SPA via `HOSTING_WEB`, the YARP frontend proxy rewrites the served `index.html` at the edge with a `ReadOnlySequence<byte>`-based streaming replacer that injects `<meta name="enamad" content="{token}" />` into `<head>` before flushing to the client. The developer never hardcodes regulatory tokens into their frontend repository.
* **Fallback Compliant Storefront:** If `HOSTING_WEB` is not yet populated with a build, `GET /` renders a complete, styled Persian storefront page containing the project's registered legal title, support landline, physical address, Terms of Service (*قوانین و مقررات*), Privacy Policy, e-Namad seal anchor, and Rial service catalog.

### 4.4 Static Egress NAT Gateway Pool (`STATIC_EGRESS_NAT`)

All outbound HTTP traffic from Jint function hosts and payment verifiers is routed through a high-availability pair of Linux policy-routing NAT gateways holding fixed, whitelisted Iranian IPv4 addresses. This guarantees that IP-restricted banking APIs (Behpardakht, SEP, Parsian, Zarinpal) and SMS gateways never reject server-to-server requests due to dynamic container IP rotation.

* **Enforcement:** `egressFetch` (see §5.3) binds its outbound `HttpMessageHandler` to a source IP selected from the NAT pool, or routes through an internal HTTP forward-proxy sidecar managed by the `worker` role. RFC 1918 blocking is applied post-DNS-resolution.
* **Failover:** Keepalived-managed VIPs on the NAT gateways; if the primary gateway loses BGP reachability, the secondary takes over within 3 seconds.

---

## 5. Exhaustive Service Specifications (All 15 Production Engines)

### 5.1 Relational Data Plane & Auto-API (`BAAS_DB`)

* **Architecture:** PostgreSQL 18.1 → `NpgsqlDataSource` (built-in multiplexing + `NpgsqlDbType` batching) → ASP.NET Core 10 **Dynamic SQL Endpoint Middleware**.
* **Connection Context Injection:** The Edge node validates `Authorization: Bearer <jwt>` locally using cached `Ed25519` public keys. The request-scoped `NpgsqlConnection` issues `SET LOCAL request.jwt.claim.sub = '...'; SET LOCAL request.jwt.claim.role = '...'; SET LOCAL search_path = prj_{slug}, auth, public;` before opening the transaction, so RLS policies and helper functions (`auth.uid()`, `auth.role()`) behave exactly as in a PostgREST deployment.
* **Zero-Allocation JSON Streaming:** Response serialization uses C# 14 `ref struct` readers over `NpgsqlDataReader` writing directly into `System.IO.Pipelines.PipeWriter`. No intermediate `DataTable`, no `JsonDocument`, no per-row `object` boxing. Benchmarked at ~1.4M rows/s serialized on a single core.
* **Row-Level Security (RLS):** Every tenant table created via the platform has `ENABLE ROW LEVEL SECURITY` turned on by default. No data is readable or writable over public REST/GraphQL endpoints unless an explicit policy grants access.
* **Schema Introspection & Automated Type Generation:** Whenever a DDL migration executes, the platform introspects `pg_catalog` and generates downloadable/CLI-pullable type-safe SDKs for **TypeScript, Swift, Kotlin, and Dart**.
* **Guardrails:** Per-connection `SET LOCAL statement_timeout = 5000; SET LOCAL idle_in_transaction_session_timeout = 3000; SET LOCAL lock_timeout = 2000;`.

### 5.2 Identity, Access Management & Domestic OTP (`IDAAS`)

* **Primary Flow (Iran Mobile OTP):**
  * Endpoint: `POST /_baas/v1/auth/otp/request` (`{ "phone": "+989123456789", "channel": "sms" }`).
  * Rate Limiting: Enforced in Redis via atomic Lua sliding windows (max 1 OTP per 120s per phone; max 5 OTPs per 15m per IP; automatic temporary IP block on enumeration patterns).
  * OTP Storage: Generates a CSPRNG 6-digit code, stores `HMAC_SHA256(code, project_secret)` in Redis (`localme:prj_{id}:otp:{phone}`) with a 120-second TTL and `attempts = 0`.
  * Dispatch: Invokes the project's configured **Jint** OTP Dispatch Hook (pre-populated with MeliPayamak, Kavenegar, FarazSMS, or Bale/Telegram bot templates).
  * Verification: `POST /_baas/v1/auth/otp/verify` verifies the HMAC. If `attempts` reaches 3, the OTP key is immediately destroyed.

* **Secondary Auth Flows:** Email/Password (**Argon2id** via `Konscious.Security.Cryptography.Argon2`, $m=65536, t=3, p=4$), OAuth2/OIDC (Google, Apple Sign-In, GitHub, and custom domestic OIDC), and WebAuthn/Passkeys (`Fido2NetLib`).

* **Session & Token Lifecycle:**
  * **Access Token:** 15-minute `Ed25519` JWT signed with the project's per-project key pair.
  * **Refresh Token:** 30-day opaque token (`rt_{random_256_bit}`) stored in `prj_{slug}.auth.refresh_tokens` and cached in Redis. Implements strict **Refresh Token Rotation** with family-wide revocation if a consumed token is replayed.

### 5.3 Sandboxed Compute & Script Engine (`COMPUTE_EDGE`)

* **Default Engine:** **Jint 4.x** — pure managed JavaScript interpreter.
  * Sub-10ms cold start via a warm `JintEngine` pool with pre-parsed `Script` objects per project.
  * Strict memory ceiling (`Options.LimitMemory(16_000_000)` — 16 MB default, configurable up to 128 MB) enforced by the Jint memory governor.
  * Preemptive execution timeout (`Options.TimeoutInterval(TimeSpan.FromSeconds(5))`) and wall-clock timeout (`CancellationToken` 15s).
  * Outbound `egressFetch()` routes exclusively through the **Static Egress NAT Pool** with DNS-rebinding and RFC 1918 private subnet blocking.
  * Deterministic execution — no reliance on native code, no `libClearScriptV8.so`, no unmanaged heap segments.

* **Opt-In Engine (dedicated nodes only):** `Microsoft.ClearScript.V8` for projects flagged `uses_clearscript_v8 = true`, running on `worker`-role nodes that allocate unmanaged V8 heap limits via `V8RuntimeConstraints`. This path is unavailable on shared `data`-role nodes.

* **Included Production Templates:**
  1. `template-sms-melipayamak` — Pattern-based service line OTP sender (`BaseServiceNumber`).
  2. `template-sms-kavenegar` — Lookup verification sender.
  3. `template-kyc-shahkar` — National ID (*کد ملی*) + mobile ownership verification via third-party KYC aggregators (Finnotec, Zibal, Jibit) that writes verification proof to `auth.users`.
  4. `template-webhook-handler` — HMAC signature verifier for external webhooks.
  5. `template-push-fanout` — Dual-mode FCM/APNs + MQTT dispatch helper.

### 5.4 Financial IRR Ledger, Managed IPG Bridge & Domestic IAP (`FIN_IPG` & `FIN_IAP`)

#### A. Strictly Rial (`IRR`) Double-Entry Ledger

* All monetary columns across the entire platform use `BIGINT` representing exact **Iranian Rials (`IRR`)**.
* Every balance modification requires a unique `idempotency_key` and writes an immutable row to `finance.ledger_entries` within a `SERIALIZABLE` or row-locked (`SELECT ... FOR UPDATE`) transaction on `finance.wallets`.
* Client SDKs expose formatting utilities (`toTomanString(irrBigInt)`) for UI presentation only.

#### B. Managed IPG Callback & Mobile Deep-Link Bridge

1. **Initiation (`POST /_baas/v1/pay/ipg/request`):** Client passes `amount_irr`, `provider` (`ZARINPAL`, `SEP`, `BEHPARDAKHT`, …), `callback_deep_link`, and `metadata`.
2. **Token Acquisition:** Platform calls the PSP's token endpoint via the Static Egress NAT IP, records an `INITIATED` row in `finance.ipg_transactions`, and returns `{ "transaction_id": "uuid", "payment_url": "https://..." }`.
3. **Bank Callback (`GET|POST /_baas/v1/pay/ipg/callback/{transaction_id}`):** Shaparak redirects the user's browser to the project's static subdomain.
4. **Server-to-Server Verification:** The platform acquires a Redis distributed lock on `localme:prj_{id}:ipg:tx:{transaction_id}`, calls the PSP `Verify` API via the Static Egress NAT IP, validates that the paid amount equals `amount_irr`, commits the credit to `finance.wallets` + `finance.ledger_entries`, optionally runs the developer's `onPaymentVerified` Jint hook, and returns an **HTTP 302 Redirect** (plus an HTML fallback page with an explicit "Open App" button for strict mobile browsers) pointing to `myapp://checkout/result?tx_id={uuid}&status=VERIFIED&ref_id={ref}`.

#### C. Domestic & Global Mobile IAP Validation (`FIN_IAP`)

* Supports **Cafe Bazaar (Poolkey REST API)**, **Myket Developer API**, **Apple App Store Server API (StoreKit 2 JWS)**, and **Google Play Developer API**.
* Client sends purchase receipt/token to `POST /_baas/v1/iap/verify`.
* Platform validates the receipt server-to-server, enforces uniqueness on `(provider, purchase_token)` to block replay attacks, updates `finance.entitlements`, and returns active user entitlements.

### 5.5 Real-Time PubSub & Offline-First HLC Sync Engine (`RTAAS` & `RTDAAS`)

#### A. Real-Time Realtime Hub (`RTAAS`)

* **Primary transport:** **ASP.NET Core SignalR** with the **Redis backplane** (`Microsoft.AspNetCore.SignalR.StackExchangeRedis`) for multi-node fanout.
* **CDC Source:** A Redis Streams consumer (`localme:prj_{id}:stream:cdc`) populated by (a) the Dynamic SQL Middleware's write interception, and (b) PostgreSQL `LISTEN/NOTIFY` triggers. WAL logical replication is **not used** (see Directive 1).
* Connected clients subscribe to table channels, presence channels, or ephemeral broadcast rooms (`/_baas/v1/realtime`). Row events are filtered against the subscriber's JWT claims before transmission.

#### B. Offline-First Hybrid Logical Clock Sync (`RTDAAS`)

* Tables enabled for Offline Sync automatically receive three system columns maintained by PostgreSQL triggers: `_hlc` (64-bit Hybrid Logical Clock combining physical ms + logical counter), `_deleted` (`BOOLEAN` tombstone), and `_server_version` (`BIGINT` monotonic sequence).
* Mobile and Web SDKs maintain an embedded SQLite replica.
* **Delta Pull (`GET /_baas/v1/sync/pull?table=orders&since_version=1042`):** Streams all rows where `_server_version` is greater than `1042` (including tombstones where `_deleted = true`).
* **Mutation Push (`POST /_baas/v1/sync/push`):** Replays offline client mutations. Conflicts are resolved deterministically via HLC comparison (`CLIENT_WINS` / `SERVER_WINS`) or delegated to a registered Jint conflict resolver script.

### 5.6 Persistent Event Streaming (`EDA_STREAM`)

* **Engine:** **Redis Streams** (`XADD` / `XREADGROUP` / `XACK` / `XCLAIM`) via `StackExchange.Redis`.
* **Capabilities:**
  * At-least-once delivery semantics with consumer groups and pending-entry-list (PEL) tracking.
  * Idempotency via a `msg_uuid` field deduplicated in a companion Redis Set with a rolling TTL.
  * `XACK`-based acknowledgement, `XAUTOCLAIM` for stalled consumers, and a dead-letter stream (`localme:prj_{id}:stream:dlq:{stream}`) when `delivery_count` exceeds `max_deliver`.
  * Native webhook or Jint hook bindings so events published to a stream automatically trigger serverless workers.

### 5.7 Deterministic Durable Execution & Workflow Engine (`WORKFLOW_DUR`)

* **Architecture:** Event-sourced workflow orchestrator built on Redis Streams timers and PostgreSQL `workflows.executions` + `workflows.step_journal` tables.
* **Deterministic Replay Model:**
  * Workflows are authored in TypeScript and executed inside **Jint**.
  * Each side-effecting operation is wrapped in `await step.run("charge-wallet", async () => { ... })`.
  * Completed steps persist their JSON output in `workflows.step_journal`. If a subsequent step throws or times out, the orchestrator re-enqueues a delayed message on `localme:prj_{id}:workflow:timers` (via a Redis ZSET-based timer wheel). On re-invocation, prior completed steps return their journaled outputs in under 1ms without re-executing side effects.
  * Supports `await step.sleep("wait-7-days", 604800)`, `await step.waitForEvent("kyc-approved", { timeoutSeconds: 86400 })`, and structured **Saga Compensation** (`step.compensate(...)`) to roll back earlier steps in reverse order on terminal failure.

### 5.8 Stateful Cache, Distributed Locks & Rate Limiting (`CACHE_LOCK`)

* **Engine:** **Redis 7/8** (all keys namespaced under `localme:prj_{id}:*`).
* **Primitives Exposed via REST, SDK, and Jint Loopback:**
  1. **Namespaced KV & Hashes:** `GET`, `SET`, `DEL`, `INCRBY`, `HSET`, `HGETALL` with millisecond TTLs.
  2. **Fenced Distributed Mutexes:** `LOCK(resource, ttl_ms)` returns `{ acquired: true, fencing_token: 94812 }` via a pre-loaded Lua script implementing Redlock semantics with a monotonic counter. Downstream database writes can assert the `fencing_token` to guarantee safety even if a lock expires mid-execution.
  3. **Atomic Rate Limiters:** GCRA (Generic Cell Rate Algorithm) token buckets implemented as a single Lua script returning `{ allowed: boolean, remaining: number, reset_after_ms: number }`.

### 5.9 Multi-Adapter Blob Storage & Media Processing (`STORAGE_BLOB`)

* **Storage Adapter Layer (`IBlobStorageAdapter`):** Unified .NET interface with pluggable implementations — **RunflareBlobAdapter (default)**, **ArvanS3Adapter**, **ParsPackS3Adapter**, **MinioS3Adapter**, **AwsS3Adapter**, **CloudflareR2Adapter**, **LocalDiskAdapter**. Configured per project via `projects.storage_adapter_key` and `projects.storage_adapter_config`.
* **Access Control:** Metadata is tracked in `prj_{slug}.storage.objects`. Uploads and downloads evaluate PostgreSQL RLS policies against the caller's JWT before streaming bytes or issuing presigned URLs (delegated to the active adapter's `CreatePresignedGetUrlAsync`).
* **TUS v1.0.0 Resumable Uploads:** **`tusdotnet`** middleware hosting chunked uploads at `/_baas/v1/storage/tus`, storing partial chunks on local NVMe scratch until final assembly, then handing the assembled stream to the active adapter. Immune to unstable mobile 3G/4G drops.
* **On-the-Fly Image Transformation (`IMAGESHARP_PROXY`):** Powered by **`SixLabors.ImageSharp.Web`**. Resizes, crops, watermarks, strips EXIF, and transcodes images to `WebP` or `AVIF` via URL parameters (`?w=600&h=400&fit=cover&q=80&format=auto`).

### 5.10 Asynchronous Heavy Processing Pipelines (`COMPUTE_HEAVY`)

* **Architecture:** Dedicated `worker`-role nodes with local **RAID-0 NVMe scratch arrays** consuming jobs from `localme:prj_{id}:stream:jobs.heavy` in Redis Streams.
* **Execution Model:**
  * Input files are streamed directly from the active blob adapter to local NVMe scratch files, never buffering entire files in .NET heap memory (uses `Stream.CopyToAsync` with a 64KB pooled buffer).
  * Executes pre-hardened external binaries as child processes with strict resource limits (`systemd-run --scope -p MemoryMax=... -p CPUQuota=...`): **FFmpeg** for HLS/DASH video transcoding, **Chromium-Headless** for HTML-to-PDF rendering, **Tesseract** for Persian/English OCR, **libarchive** (`bsdtar`) for bulk compression.
  * Streams output artifacts back to the active blob adapter, unlinks the scratch directory immediately, and emits a completion event to Redis Streams.

### 5.11 Request-Scoped Native OLAP & Analytical Engine (`OLAP_ENGINE`)

* **Engine:** **PostgreSQL 18.1 declarative partitioning**.
  * `analytics.tenant_events` is `PARTITION BY LIST (project_id)`.
  * Within each partition, `ORDER BY (project_id, toDate(event_time), event_name, event_time)` and BRIN indexes on `event_time`.
  * PG 18 native `uuidv7()` for time-ordered event IDs.
  * PG 18 **Asynchronous I/O** and **Virtual Generated Columns** reduce scan cost and storage amplification.
* **Zero Row-Bloat Authorization:** RLS is intentionally omitted inside `analytics.*` to preserve scan performance. Instead:
  * Authorization is verified **once per HTTP request** at the Analytics Gateway.
  * The gateway forces `WHERE project_id = {authenticated_project_uuid}` at the outermost scan boundary. All queries run through `QueryPlanValidator` which rejects any AST that does not carry this predicate.
* **Dual Ingestion:** Automatic real-time mirroring from selected tenant tables via the CDC pipeline (Redis Streams consumer), plus high-throughput client event ingestion (`POST /_baas/v1/analytics/events`) with batch `COPY`-like `NpgsqlBinaryImporter`.

### 5.12 Dual-Mode (Global + Domestic Intranet) Push Engine (`PUSH_ENGINE`)

* **Architecture:** Dispatches notifications simultaneously across international and domestic channels with client-side deduplication.
* **Channels:**
  1. **Apple APNs:** Persistent HTTP/2 connection pool using `.p8` JWT authentication (`HttpClient` with `SocketsHttpHandler.EnableMultipleHttp2Connections = true`).
  2. **Google FCM:** HTTP v1 API routed through the **International Relay PoP** so the server can reach Google even when domestic international routing is degraded.
  3. **Domestic Intranet Broker (`MQTTNET_BROKER`):** Embedded high-concurrency **MQTT v5 over WebSocket** broker hosted by **`MQTTnet.AspNetCore`** directly on Kestrel port 443, inside Iranian domestic data centers.
* **Deduplication Contract:** Every push payload includes a `msg_uuid`. The mobile SDK stores a rolling 500-item ring buffer of rendered `msg_uuid` values in local SQLite/SharedPreferences. Whether FCM or the Domestic MQTT channel delivers the packet first, the notification is displayed immediately, and the duplicate arrival on the second channel is silently discarded.

### 5.13 Mobile Release, Remote Config & Deep-Link Manager (`MOBILE_OPS`)

* **Edge-Cached Remote Config:** Key-value and JSON feature flags with rule targeting (app version, OS platform, percentage rollout via consistent hashing on `device_id`). Served from Redis/Edge memory in under 2ms.
* **Self-Hosted APK & Store Release Manager:** Developers upload signed `.apk` files to the active blob adapter and specify version constraints (`min_supported_version`, `latest_version`). The SDK checks `/_baas/v1/config` on boot and returns direct domestic CDN APK download links alongside Cafe Bazaar, Myket, and Google Play store intents.
* **Automated Deep-Link Verification:** Automatically generates and serves `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` from the project's mobile configuration.

### 5.14 Frontend Web & Static Asset Hosting Engine (`HOSTING_WEB`)

Allows frontend developers to deploy their Single-Page Applications (React, Vue, Angular, Svelte, Solid, Flutter Web) or static sites (Next.js/Nuxt/Astro static exports) directly onto their project's subdomain (`{slug}.localme.ir`) or custom domain (`myshop.ir`) with zero external hosting required.

* **Atomic Immutable Deployments:**
  * Developers deploy via CLI (`localme deploy ./dist`) or CI/CD webhook.
  * Assets are content-addressed by `SHA-256` hash and uploaded to the active blob adapter under `/deployments/{project_id}/{deployment_id}/*`.
  * Promoting a deployment to production updates a single atomic pointer in Redis (`localme:prj_{id}:active_deployment` → `deployment_id`) and in `control_plane.projects.active_web_deployment_id`, making rollbacks instantaneous (under 10ms).

* **Smart Edge Serving & SPA Routing:**
  * Immutable hashed assets (`/assets/*`) are served with `Cache-Control: public, max-age=31536000, immutable` from an in-memory `Microsoft.Extensions.Caching.Memory` cache on edge nodes.
  * Unmatched HTML navigation routes automatically fall back to `/index.html` (SPA mode) or `/404.html` while preserving all `/_baas/v1/*` and `/.well-known/*` backend routes on the exact same origin (eliminating CORS preflight overhead completely).
  * YARP's response-transforming `IHttpResponseBodyFeature` injects the project's configured `<meta name="enamad" content="..." />` tag into the served `index.html` response stream.

### 5.15 Real-Time B2B Metering, Quota Enforcement & Billing Engine (`BILLING_METER`)

* **Non-Blocking Telemetry Pipeline:** YARP, Dynamic SQL Middleware, Jint Runner, Blob Proxy, and Heavy Workers write usage metrics into `System.Threading.Channels` (bounded, drop-on-full) flushed every 5 seconds to `billing.usage_ledger_raw` (PG 18).
* **Domestic vs. International Bandwidth Split:** The Edge node inspects the client IP against an in-memory Iranian CIDR prefix table (RIPE NCC `IR` allocations) and tags every egress byte as `egress_domestic_bytes` or `egress_international_bytes`, enabling accurate domestic half-price (*ترافیک نیم‌بها*) billing calculation.
* **Real-Time Quota Circuit Breaker:** A background `worker`-role aggregator rolls up usage every 60 seconds, deducts accrued `IRR` costs from the organization wallet, and updates project quota flags in Redis. If a project exceeds its hard `monthly_spend_cap_irr` or wallet balance reaches `0 IRR`, the Edge node immediately returns `402 Payment Required` on billable endpoints while keeping the Control Plane and read-only compliance endpoints accessible.

---

## 6. Production Database Schemas & Wire Contracts

### 6.1 Control Plane PostgreSQL Schema (Full Production DDL, PG 18.1)

All tables below live in schema `control_plane` inside the single physical database **`localme`**.

```sql
CREATE DATABASE localme;
\connect localme

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE SCHEMA IF NOT EXISTS control_plane;
SET search_path = control_plane, public;

CREATE TYPE project_status AS ENUM ('PROVISIONING', 'ACTIVE', 'THROTTLED', 'SUSPENDED', 'DELETED');

CREATE TYPE capability_code AS ENUM (
    'BASE', 'BAAS_DB', 'IDAAS', 'RTAAS', 'RTDAAS', 'COMPUTE_EDGE',
    'FIN_IPG', 'FIN_IAP', 'STORAGE_BLOB', 'EDA_STREAM', 'WORKFLOW_DUR',
    'COMPUTE_HEAVY', 'CACHE_LOCK', 'OLAP_ENGINE', 'PUSH_ENGINE',
    'MOBILE_OPS', 'HOSTING_WEB'
);

CREATE TYPE primitive_code AS ENUM (
    'DNS_SUBDOMAIN', 'YARP_ROUTE', 'COMPLIANCE_RESPONDER', 'TELEMETRY_METER',
    'PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'REDIS_KV',
    'JINT_ISOLATE', 'CLEARSCRIPT_V8_ISOLATE', 'PG_LISTEN_NOTIFY', 'REDIS_STREAMS',
    'SIGNALR_GATEWAY', 'SECRET_VAULT', 'STATIC_EGRESS_NAT', 'BLOB_STORAGE_ADAPTER',
    'TUSDOTNET_PROXY', 'IMAGESHARP_PROXY', 'HEAVY_WORKER_POOL', 'PG_ANALYTICS_PART',
    'MQTTNET_BROKER', 'FCM_APNS_ADAPTER', 'EDGE_CACHE', 'LETTUCEENCRYPT_SSL'
);

CREATE TYPE primitive_state AS ENUM ('PENDING', 'PROVISIONING', 'HEALTHY', 'DEGRADED', 'SUSPENDED', 'DEPROVISIONING');

CREATE TYPE storage_adapter_kind AS ENUM (
    'RUNFLARE_BLOB', 'ARVAN_S3', 'PARSPACK_S3', 'MINIO_S3',
    'AWS_S3', 'CLOUDFLARE_R2', 'LOCAL_DISK'
);

CREATE TYPE js_engine_kind AS ENUM ('JINT', 'CLEARSCRIPT_V8');

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(120) NOT NULL,
    wallet_balance_irr BIGINT NOT NULL DEFAULT 0 CHECK (wallet_balance_irr >= 0),
    billing_email VARCHAR(255) NOT NULL,
    billing_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(63) UNIQUE NOT NULL,           -- Allocates {slug}.localme.ir
    custom_domain VARCHAR(255) UNIQUE,
    custom_domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status project_status NOT NULL DEFAULT 'PROVISIONING',
    jwt_ed25519_public_key TEXT NOT NULL,
    jwt_ed25519_private_key_enc BYTEA NOT NULL, -- Encrypted via KEK
    active_web_deployment_id UUID,
    monthly_spend_cap_irr BIGINT CHECK (monthly_spend_cap_irr IS NULL OR monthly_spend_cap_irr >= 0),
    js_engine js_engine_kind NOT NULL DEFAULT 'JINT',
    storage_adapter_key storage_adapter_kind NOT NULL DEFAULT 'RUNFLARE_BLOB',
    storage_adapter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    compliance_config JSONB NOT NULL DEFAULT '{
        "enamad_meta_token": null,
        "enamad_file_content": null,
        "samandehi_file_content": null,
        "inject_meta_in_spa": true,
        "stub_storefront_enabled": true,
        "business_title_fa": "",
        "support_phone": "",
        "legal_address_fa": "",
        "android_package_name": null,
        "android_sha256_fingerprints": [],
        "ios_app_id": null
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_slug ON projects (slug);
CREATE INDEX idx_projects_custom_domain ON projects (custom_domain) WHERE custom_domain IS NOT NULL;

CREATE TABLE project_secrets (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    secret_key VARCHAR(128) NOT NULL,
    cipher_value BYTEA NOT NULL,      -- AES-256-GCM encrypted
    nonce BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, secret_key)
);

CREATE TABLE project_capabilities (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    capability capability_code NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, capability)
);

CREATE TABLE project_primitives (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    primitive primitive_code NOT NULL,
    ref_count INT NOT NULL DEFAULT 1 CHECK (ref_count >= 0),
    state primitive_state NOT NULL DEFAULT 'PENDING',
    endpoint_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, primitive)
);

CREATE TABLE web_deployments (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha VARCHAR(64),
    file_count INT NOT NULL,
    total_size_bytes BIGINT NOT NULL,
    storage_prefix TEXT NOT NULL,      -- /deployments/{project_id}/{id}
    spa_fallback BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 Tenant Data Plane PostgreSQL Schema (Provisioned per Project)

Each project receives its own schema `prj_{slug}` plus a matching PostgreSQL role `role_prj_{slug}` with schema-scoped privileges.

```sql
-- Per-project bootstrap (executed by the DAG provisioning driver):
-- CREATE SCHEMA prj_{slug};
-- CREATE ROLE role_prj_{slug} NOLOGIN NOINHERIT;
-- GRANT USAGE ON SCHEMA prj_{slug} TO role_prj_{slug};

SET search_path = prj_{slug}, public;

-- 1. IDENTITY & AUTH SCHEMA
CREATE SCHEMA IF NOT EXISTS auth;
SET search_path = prj_{slug}, auth, public;

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    phone VARCHAR(20) UNIQUE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,               -- Argon2id
    national_code VARCHAR(10),
    is_kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(32) NOT NULL DEFAULT 'authenticated',
    raw_user_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_app_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sign_in_at TIMESTAMPTZ
);

CREATE TABLE auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    family_id UUID NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper functions for PostgreSQL RLS Policies
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE SQL STABLE;

-- 2. FINANCIAL IRR LEDGER, IPG & IAP SCHEMA
CREATE SCHEMA IF NOT EXISTS finance;

CREATE TYPE finance.ipg_provider AS ENUM ('ZARINPAL', 'BEHPARDAKHT', 'SEP', 'PARSIAN', 'IDPAY', 'ZIBAL');
CREATE TYPE finance.tx_status AS ENUM ('INITIATED', 'VERIFIED', 'FAILED', 'REVERSED');
CREATE TYPE finance.iap_store AS ENUM ('CAFEBAZAAR', 'MYKET', 'APPLE_STOREKIT', 'GOOGLE_PLAY');

CREATE TABLE finance.wallets (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    balance_irr BIGINT NOT NULL DEFAULT 0 CHECK (balance_irr >= 0),
    locked_irr BIGINT NOT NULL DEFAULT 0 CHECK (locked_irr >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finance.ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    wallet_id UUID NOT NULL REFERENCES finance.wallets(id) ON DELETE RESTRICT,
    amount_irr BIGINT NOT NULL CHECK (amount_irr <> 0),
    balance_after_irr BIGINT NOT NULL CHECK (balance_after_irr >= 0),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finance.ipg_transactions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    provider finance.ipg_provider NOT NULL,
    amount_irr BIGINT NOT NULL CHECK (amount_irr >= 10000),
    authority_token VARCHAR(255) UNIQUE,
    ref_id VARCHAR(255),
    card_pan_masked VARCHAR(32),
    card_hash VARCHAR(128),
    status finance.tx_status NOT NULL DEFAULT 'INITIATED',
    callback_deep_link TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE TABLE finance.iap_receipts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    store finance.iap_store NOT NULL,
    product_id VARCHAR(128) NOT NULL,
    purchase_token VARCHAR(512) NOT NULL,
    is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    raw_provider_response JSONB NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store, purchase_token)
);

-- 3. DURABLE WORKFLOW JOURNAL SCHEMA
CREATE SCHEMA IF NOT EXISTS workflows;

CREATE TYPE workflows.exec_status AS ENUM ('RUNNING', 'SLEEPING', 'WAITING_EVENT', 'COMPLETED', 'FAILED', 'COMPENSATING', 'COMPENSATED');

CREATE TABLE workflows.executions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workflow_name VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    status workflows.exec_status NOT NULL DEFAULT 'RUNNING',
    input_payload JSONB NOT NULL,
    output_payload JSONB,
    error_detail TEXT,
    attempt INT NOT NULL DEFAULT 1,
    wake_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflows.step_journal (
    execution_id UUID NOT NULL REFERENCES workflows.executions(id) ON DELETE CASCADE,
    step_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,          -- 'COMPLETED', 'COMPENSATED'
    output_payload JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (execution_id, step_key)
);

-- 4. PUSH NOTIFICATION DEVICE REGISTRY
CREATE SCHEMA IF NOT EXISTS push;

CREATE TABLE push.devices (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(128) NOT NULL,
    platform VARCHAR(16) NOT NULL CHECK (platform IN ('ANDROID', 'IOS', 'WEB')),
    fcm_token TEXT,
    apns_token TEXT,
    domestic_mqtt_client_id VARCHAR(128) UNIQUE NOT NULL,
    app_version VARCHAR(32),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_fingerprint)
);

-- 5. STORAGE OBJECTS METADATA
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    bucket VARCHAR(128) NOT NULL,
    object_key TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    content_type VARCHAR(255),
    etag VARCHAR(128),
    adapter_key VARCHAR(32) NOT NULL,     -- which IBlobStorageAdapter wrote it
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bucket, object_key)
);
```

### 6.3 Analytical & Metering Schema (PG 18.1 Partitioned)

```sql
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS billing;

-- 1. Tenant Analytical Event Store (Request-Level Auth, List-Partitioned by project_id)
CREATE TABLE analytics.tenant_events (
    project_id UUID NOT NULL,
    event_id UUID NOT NULL DEFAULT uuidv7(),
    user_id UUID,
    session_id TEXT,
    event_name TEXT,
    event_time TIMESTAMPTZ NOT NULL,
    client_ip INET,
    country_code CHAR(2),
    platform TEXT,
    app_version TEXT,
    properties_json JSONB,
    numeric_value DOUBLE PRECISION DEFAULT 0,
    PRIMARY KEY (project_id, event_time, event_id)
) PARTITION BY LIST (project_id);

-- Per-project partition created during DAG provisioning:
-- CREATE TABLE analytics.tenant_events_prj_{slug}
--     PARTITION OF analytics.tenant_events FOR VALUES IN ('{project_id}');

-- BRIN index for time-range scans inside each partition
CREATE INDEX brin_tenant_events_time
    ON analytics.tenant_events USING BRIN (event_time);

-- 2. Real-Time B2B Platform Metering Store
CREATE TABLE billing.usage_ledger_raw (
    project_id UUID NOT NULL,
    org_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    metric_type TEXT NOT NULL,            -- 'EGRESS_DOMESTIC', 'EGRESS_INTL',
                                          -- 'JINT_CPU_MS', 'DB_BYTES', 'HEAVY_JOB_SEC'
    quantity BIGINT NOT NULL DEFAULT 0
) PARTITION BY RANGE (recorded_at);

-- Monthly partitions created automatically by the worker role:
-- CREATE TABLE billing.usage_ledger_raw_2026_01
--     PARTITION OF billing.usage_ledger_raw
--     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### 6.4 Jint Compute & Durable Workflow SDK Contract (TypeScript)

```typescript
export interface PlatformDbTransaction {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

export interface WorkflowStepContext {
  run<T>(stepKey: string, fn: () => Promise<T>, compensateFn?: (result: T) => Promise<void>): Promise<T>;
  sleep(stepKey: string, durationSeconds: number): Promise<void>;
  waitForEvent<T = unknown>(stepKey: string, eventTopic: string, timeoutSeconds: number): Promise<T>;
}

export interface PlatformContext {
  readonly project: { readonly id: string; readonly slug: string };
  readonly request: {
    readonly method: string;
    readonly path: string;
    readonly headers: Record<string, string>;
    readonly query: Record<string, string>;
    readonly clientIp: string;
    readonly isDomesticIranIp: boolean;
    json<T = unknown>(): Promise<T>;
  };
  readonly auth: {
    readonly userId: string | null;
    readonly role: "anon" | "authenticated" | "service_role";
    readonly claims: Record<string, unknown>;
  };
  readonly secrets: {
    get(key: string): string | undefined;
  };
  readonly db: {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
    transaction<T>(fn: (tx: PlatformDbTransaction) => Promise<T>): Promise<T>;
  };
  readonly cache: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    withLock<T>(resource: string, ttlMs: number, fn: (fencingToken: number) => Promise<T>): Promise<T>;
    rateLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }>;
  };
  readonly streams: {
    publish(topic: string, payload: unknown, idempotencyId?: string): Promise<void>;
  };
  readonly push: {
    sendToUser(userId: string, notification: { title: string; body: string; data?: Record<string, string> }): Promise<void>;
  };
  readonly heavyJobs: {
    enqueue(pipeline: "FFMPEG_HLS" | "HTML_TO_PDF" | "IMAGE_BATCH" | "OCR_DOCUMENT", params: Record<string, unknown>): Promise<{ jobId: string }>;
  };
  // Guaranteed to exit via Whitelisted Iranian Static Egress NAT IPs
  readonly egressFetch: typeof fetch;
}
```

---

## 7. Complete Unified API Endpoint Reference

All tenant endpoints are served on `https://{project-slug}.localme.ir` or the project's bound custom domain:

| Subsystem | Method & Route | Description |
| --- | --- | --- |
| **Compliance & Links** | `GET /enamad.txt`, `GET /samandehi.txt` | Serves dynamic plain-text regulatory ownership tokens. |
| **Compliance & Links** | `GET /.well-known/assetlinks.json` | Serves Android App Links SHA-256 package verification JSON. |
| **Compliance & Links** | `GET /.well-known/apple-app-site-association` | Serves iOS Universal Links bundle verification JSON. |
| **Authentication** | `POST /_baas/v1/auth/otp/request` | Triggers rate-limited OTP generation and invokes project SMS/messenger script. |
| **Authentication** | `POST /_baas/v1/auth/otp/verify` | Verifies OTP and issues `Ed25519` Access JWT + Refresh Token. |
| **Authentication** | `POST /_baas/v1/auth/token/refresh` | Rotates Refresh Token and issues new Access JWT. |
| **Authentication** | `POST /_baas/v1/auth/oauth/{provider}` | Initiates OAuth2/OIDC flow (Google, Apple, custom domestic OIDC). |
| **Relational Data** | `GET | POST | PATCH | DELETE /_baas/v1/rest/{table}` | Dynamic SQL API (PostgREST-compatible wire contract). |
| **Relational Data** | `POST /_baas/v1/rpc/{function_name}` | Invokes PostgreSQL stored procedures transactionally. |
| **Relational Data** | `POST /_baas/v1/graphql` | Auto-generated GraphQL AST-to-SQL endpoint. |
| **Real-Time & Sync** | `GET /_baas/v1/realtime` (`Upgrade: websocket`) | SignalR multiplexed channel for CDC subscriptions, presence, broadcast. |
| **Real-Time & Sync** | `GET /_baas/v1/sync/pull` | Pulls HLC delta changes and tombstones since device checkpoint. |
| **Real-Time & Sync** | `POST /_baas/v1/sync/push` | Pushes offline SQLite mutation queue and resolves HLC conflicts. |
| **Payments & IAP** | `POST /_baas/v1/pay/ipg/request` | Requests Shaparak/Zarinpal payment token via Static Egress NAT. |
| **Payments & IAP** | `ANY /_baas/v1/pay/ipg/callback/{tx_id}` | Receives bank redirect, verifies server-to-server, updates IRR ledger, redirects to Deep Link. |
| **Payments & IAP** | `POST /_baas/v1/iap/verify` | Validates Cafe Bazaar, Myket, StoreKit 2, or Google Play purchase receipts. |
| **Storage & Media** | `POST | PATCH | HEAD /_baas/v1/storage/tus/*` | TUS v1.0.0 resumable upload endpoint (`tusdotnet`). |
| **Storage & Media** | `GET /_baas/v1/storage/render/{bucket}/{path}` | On-the-fly WebP/AVIF resizing and transformation proxy (ImageSharp). |
| **Storage & Media** | `GET | PUT | DELETE /_baas/v1/storage/object/{bucket}/{path}` | Blob storage proxy delegating to the active `IBlobStorageAdapter`. |
| **Compute & Workflows** | `ANY /_baas/v1/functions/{script_slug}` | Synchronously executes a sandboxed Jint script. |
| **Compute & Workflows** | `POST /_baas/v1/workflows/{workflow_name}/start` | Starts or resumes a deterministic durable workflow execution. |
| **Push & Mobile Ops** | `GET /_baas/v1/mqtt` (`Upgrade: websocket`) | Domestic Intranet MQTT-over-WebSocket push notification channel. |
| **Push & Mobile Ops** | `POST /_baas/v1/push/register` | Registers/updates device FCM, APNs, and Domestic MQTT tokens. |
| **Push & Mobile Ops** | `GET /_baas/v1/config` | Returns Edge-cached Remote Config flags and APK/Store update policy. |
| **OLAP Analytics** | `POST /_baas/v1/analytics/events` | High-throughput batch ingestion into PG 18 partitioned analytics. |
| **OLAP Analytics** | `POST /_baas/v1/analytics/query` | Executes tenant-partitioned analytical queries against PG 18. |
| **Frontend Hosting** | `GET /*` | Serves immutable SPA/static frontend builds (or compliant e-Namad stub if unpopulated). |

---

## 8. Non-Functional SLAs, Zero-Trust Security & TDD Architecture

### 8.1 Production Performance SLAs

* **Edge Gateway + JWT Verification Overhead:** Under 1.5ms p99 (YARP + cached Ed25519 keys).
* **Redis Cache / Lock / Rate-Limit Operations:** Under 1.0ms p99 inside the cluster.
* **Dynamic SQL Indexed Single-Table Read/Write:** Under 8ms p95.
* **Jint Script Cold Start:** Under 10ms p99; per-invocation memory footprint capped at 16MB (default).
* **Postgres WAL Commit to Client SignalR Frame:** Under 20ms p95.
* **PG 18 Analytical Aggregation (10M Rows, BRIN-assisted):** Under 250ms p95 (target; higher than native ClickHouse by design — acceptable trade-off for stack consolidation).

### 8.2 Zero-Trust Security Controls

1. **SSRF & Internal Network Isolation:** The Jint `egressFetch` network stack resolves DNS prior to socket connection and drops any connection targeting private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `fc00::/7`, `fe80::/10`).
2. **Envelope Encryption:** Every project receives a unique 256-bit Data Encryption Key (DEK). All `project_secrets` and custom OAuth/IAP credentials are encrypted with **AES-256-GCM** using the project's DEK, and the DEK is encrypted at rest using the platform's master Key Encryption Key (KEK) held in environment configuration.
3. **Database Resource Guardrails:** Every tenant transaction sets `statement_timeout = 5000ms`, `idle_in_transaction_session_timeout = 3000ms`, and `lock_timeout = 2000ms`. The Dynamic SQL Middleware additionally enforces row-count caps (`max_rows = 10_000` default) and rejects queries without a partition-pruning predicate on `analytics.tenant_events`.
4. **Jint Sandbox:** `Options.AllowClr()` is **never** enabled. The Jint engine is configured with `Options.Strict(true)` and an explicit allowlist of host bindings (`console`, `fetch` mapped to `egressFetch`, `crypto`, `TextEncoder`, `TextDecoder`, `setTimeout` shim via the CancellationToken).
5. **Role Isolation:** Every tenant schema is owned by a dedicated `role_prj_{slug}` PostgreSQL role with `NOINHERIT` and no `LOGIN`. The Data Plane uses `SET LOCAL ROLE role_prj_{slug}` before executing tenant SQL.

### 8.3 Test-Driven Development (TDD) & Continuous Verification Suite

1. **Domain & Invariant Unit Suite:**
   * Exhaustive DAG graph resolution tests verifying reference counting across all capability combinations and cycle rejection.
   * `IRR` Ledger property-based tests (`FsCheck`) — fuzzing concurrent credits, debits, locks, and duplicate `idempotency_key` replays to verify zero balance drift.

2. **Multi-Tenant Security & Isolation Integration Suite:**
   * `Testcontainers`-based ephemeral harnesses (PostgreSQL 18.1, Redis 7) verifying that a valid JWT for Project A cannot read, mutate, subscribe to, or query data belonging to Project B across all 15 engines.

3. **Network Partition & Regulatory Chaos Suite:**
   * Simulates blackholing international BGP routes (blocking FCM and APNs) and asserts that 100% of push notifications arrive on connected Android/Web clients via the Domestic MQTT broker in under 500ms.
   * Simulates concurrent duplicate Shaparak bank callback deliveries and verifies that the Redis lock + PostgreSQL idempotency constraint results in exactly one ledger credit.

4. **Blob Adapter Portability Suite:**
   * Every `IBlobStorageAdapter` implementation runs the identical compliance test battery (`PutObjectAsync`, `GetObjectAsync`, multipart, presigned URLs, TUS hand-off) against `LocalDiskAdapter` and `MinioS3Adapter` in CI, guaranteeing any future adapter implementation is a plug-in replacement.

---

## 9. Production Cluster Topology & Bootstrapping Order

### 9.1 Reference Topology (Iranian Tier-3/4 Data Center)

```
+---------------------------------------------------------------------------------------------------+
|                          DOMESTIC DATA CENTER (MAIN PRODUCTION ZONE)                              |
|                                                                                                   |
|  [Edge Node Role — 2x VMs, 2 vCPU / 4GB each]                                                     |
|   - Kestrel + YARP + LettuceEncrypt + Compliance Responder + Frontend edge cache                  |
|   - ARSoft.Tools.Net authoritative DNS service                                                    |
|                                                                                                   |
|  [Control Node Role — 2x VMs, 4 vCPU / 8GB each]                                                  |
|   - Control Plane Modular Monolith (ASP.NET Core 10)                                              |
|   - DAG Provisioning Drivers                                                                      |
|                                                                                                   |
|  [Data Node Role — 2x VMs, 8 vCPU / 16GB each]                                                    |
|   - Dynamic SQL API + SignalR Hub + MQTTnet Broker                                                |
|   - Jint Function Host (shared pool) + TUS + ImageSharp.Web                                       |
|   - IPG Callback Bridge + IAP Validator + Remote Config                                           |
|                                                                                                   |
|  [Worker Node Role — 2x VMs, 8 vCPU / 16GB + RAID-0 NVMe]                                         |
|   - Redis Streams consumers: workflow orchestrator, CDC fanout, billing rollups                   |
|   - Heavy Worker Pool (FFmpeg / Chromium-Headless / Tesseract / bsdtar)                           |
|   - Static Egress NAT Gateway sidecar (policy routing)                                            |
|                                                                                                   |
|  [Stateful Data Tier — managed or self-hosted]                                                    |
|   - PostgreSQL 18.1 (single database: "localme"), Patroni HA if self-hosted                      |
|   - Redis 7/8 (logical namespace: "localme"), Sentinel or Cluster mode                            |
|   - Blob Storage Adapter: Runflare Blob (default) / ArvanS3 / ParsPackS3 / MinIO                  |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 | (Encrypted WireGuard / IPSec Tunnel)
                                                 v
+---------------------------------------------------------------------------------------------------+
|                        INTERNATIONAL RELAY POP (FRANKFURT / FALKENSTEIN)                          |
|   - Outbound Relay Proxy for Google FCM, Apple APNs, Google/Apple OAuth, and Global Webhooks      |
+---------------------------------------------------------------------------------------------------+
```

### 9.2 Deterministic System Bootstrap Sequence

1. **Layer 0 (Storage & Consensus):**
   * Provision PostgreSQL 18.1 with `CREATE DATABASE localme;` and apply migrations for `control_plane`, `analytics`, `billing`.
   * Provision Redis 7/8 and pre-load all Lua scripts (`gcra_limiter.lua`, `fenced_redlock.lua`, `otp_verify.lua`) via `SCRIPT LOAD` on startup.
   * Provision the default blob adapter (Runflare Blob bucket + access keys) and validate with a smoke-test object put/get.

2. **Layer 1 (Network & Egress):**
   * Configure Static Egress NAT Gateways (`iptables` SNAT to whitelisted Iranian IPs).
   * Establish the encrypted WireGuard tunnel to the International Relay PoP.
   * Confirm outbound reachability to Zarinpal, Shaparak, FCM, APNs test endpoints.

3. **Layer 2 (Control Plane & Migrations):**
   * Apply Control Plane DDL (§6.1) and start the Control Plane node role.
   * Seed the initial Organization, admin user, and platform KEK.
   * Confirm the DAG resolver self-test suite passes with zero primitives in a degraded state.

4. **Layer 3 (Data Plane Workers):**
   * Start the Data node role (Dynamic SQL, SignalR, MQTTnet, Jint pool, TUS, ImageSharp, IPG bridge).
   * Start the Worker node role (workflow orchestrator, CDC fanout, heavy job consumers, billing rollups).
   * Warm the Jint engine pool with all stock templates.

5. **Layer 4 (Edge & DNS Activation):**
   * Start the Edge node role — Kestrel binds `:443`, YARP loads the initial route table from `control_plane.projects`, LettuceEncrypt performs the first ACME challenge for the wildcard `*.localme.ir` certificate.
   * Start the authoritative DNS service on `:53` and confirm propagation of the wildcard A record.
   * Verify end-to-end: create a smoke-test project, deploy a static SPA, hit `https://smoketest.localme.ir/`, confirm `/enamad.txt` and `/_baas/v1/config` respond correctly.

---

**End of Document — v1.0.0-FINAL**

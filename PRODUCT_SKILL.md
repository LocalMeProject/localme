# Product Operating Skill Manifest: Monorepo Governance

This is the **tailored operating skill** for this product monorepo. Agents working on this codebase must strictly observe the localized rules and profile mappings below.

---

## 1. Monorepo Project & Profile Matrix

| Project Name | Project Path | Architectural Profile | Scope |
|---|---|---|---|
| `cli` | `apps/cli` | **Profile A** | `backend` |
| `client-sdk` | `libs/client-sdk` | **Profile D** | `shared` |
| `contracts` | `libs/contracts` | **Profile D** | `shared` |
| `core-domain` | `libs/core-domain` | **Profile A** | `backend` |
| `data-plane` | `libs/data-plane` | **Profile A** | `backend` |
| `infrastructure` | `libs/infrastructure` | **Profile A** | `backend` |
| `server` | `apps/server` | **Profile A** | `backend` |
| `web-console` | `apps/web-console` | **Profile B** | `frontend` |

---

## 2. Active Architectural Profiles & Invariants

### Profile A (Backend DDD & Hexagonal Architecture)
- Pure Domain logic: zero framework or ORM imports in domain layer.
- Real ephemeral containers (Podman/Docker) for all database integration tests.
- Strict UTC storage convention for all timestamps and events.
- Transactional Outbox pattern for publishing domain events.
### Profile B (Web Applications)
- Strict WCAG 2.1 AA accessibility (a11y) compliance.
- Core Web Vitals performance targets (LCP < 2.5s, CLS < 0.1).
- Typed API client contracts derived from backend schemas (OpenAPI/Protobuf).
### Profile D (Shared Contracts & Core Libraries)
- Pure stateless schemas, serializers, or utility functions.
- Zero dependencies on concrete services or application code.
- Semantic versioning and backward-compatible schema evolutions.

### Section 2.1: DBaaS Operational & Security Invariants
1. **Zero Direct Datastore Access**: Direct PostgreSQL connection strings, credentials, and connection URI panels are strictly forbidden from being displayed, logged, or exposed in developer portals or client SDKs. All operations route exclusively through authenticated LocalMe gateway routes (`/_baas/v1/*`).
2. **Strict SQL Runner Guardrails**: The raw SQL execution engine (`/_baas/v1/{projectId}/sql/execute` and `/db/sql`) enforces strict DML-only execution. All DDL operations (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`) are blocked at the gateway and reserved exclusively for Schema Designer endpoints.
3. **Automated Snapshot Lifecycle**: Tenant database snapshots enforce a 3-day retention policy (`RetentionDays = 3`, configurable by system administrators). Expired snapshot records and disk assets must be automatically pruned.
4. **Bounded-Resource & High-Throughput Architecture (1M+ req/day on limited RAM)**:
   - **Bounded Metadata Caching**: In-memory caches (such as tenant schema metadata, auth keys, and table lookups) must strictly employ bounded caching primitives (`IMemoryCache` / `MemoryCache` with `SizeLimit` and sliding/absolute TTL eviction). Unbounded `ConcurrentDictionary` storage for tenant assets is strictly forbidden.
   - **Stream-First Payloads**: Operations handling dynamic or unbounded datasets (database snapshots, batch exports, large query results) must stream directly through IO primitives (`Utf8JsonWriter`, `PipeWriter`, `FileStream`) rather than materializing large contiguous JSON strings or intermediate DOMs in the Large Object Heap (LOH).
   - **Defensive Resource Caps**: Query limits, transaction timeouts (5s statement, 2s lock), and connection pool multiplexing must remain strictly enforced to guarantee sub-8ms p95 SLAs on shared nodes.

### Section 2.2: Brand Identity, SLA & Launch Scope Invariants
1. **Brand Representation («لوکال می»)**:
   - Always write the brand name in Persian as **«لوکال می»** with a standard ASCII space (`\u0020`).
   - Using half-spaces (Zero-Width Non-Joiner / ZWNJ `\u200c`) is strictly forbidden across all metadata, UI text, documentation, and SEO assets.
   - In Persian prose and marketing, use «لوکال می» rather than the Latin "LocalMe".
2. **Latency & Uptime SLA**:
   - Official SLA: **Sub-300ms** response time nationwide across MCI, Irancell, Rightel, and fixed broadband.
   - Availability: **100% Uptime** backed by domestic Tehran datacenters and direct National Information Network (IXP) peering.
   - Never claim sub-10ms latency in public copy.
3. **Audience Framing**:
   - Primary focus: Mobile developers (Flutter, React Native, Android Kotlin, iOS Swift).
   - Comprehensive support: All frontend developers (React, Vue, Next.js, Web apps).
   - Core value proposition: The sovereign Iranian Supabase/Firebase alternative.
4. **Launch Feature Boundary**:
   - Only promote the 5 launch offerings: (1) Database, (2) Simple Auth & User Management (without OTP), (3) Storage, (4) Edge Functions, (5) Ambient Project Telemetry.
   - SMS/OTP and marketplace IAP validations are strictly out-of-scope for launch SEO and landing pages.

---

## 3. High-Velocity Single-Turn Ingestion Mandate (P0)

AI agents are **strictly forbidden from reading files one by one with sequential tool calls**.
Before modifying code:
1. Ingest all target files in a single turn:
   ```bash
   python3 scripts/ep.py pack --surface
   ```
2. For diff-based modifications:
   ```bash
   python3 scripts/ep.py pack --diff
   ```

---

## 4. Local Execution & Mechanical Verification

- **Run target**: `python3 scripts/ep.py run <project>:<target>`
- **Verify blast radius**: `python3 scripts/ep.py surface check-diff --strict`
- **Verify compliance**: `python3 scripts/ep.py verify`
- **10-Dimension Audit**: `python3 scripts/ep.py audit`
- **Run test suite**: `python3 -m unittest discover tests` (or native project test runner)

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

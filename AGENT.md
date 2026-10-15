# Enterprise Monorepo Root Agent Manifest: LocalMe

This document defines the root governance invariants, prime directives, architectural profiles, and engineering standards for the **LocalMe** monorepo. All AI agents, contributors, and automation pipelines must strictly conform to these rules.

---

## 1. Governance Hierarchy & Cascading Order
- Directives cascade strictly: **Tier 1 Inviolables $\implies$ Root AGENT.md $\implies$ Subproject AGENT.md**.
- Subproject manifests configure local toolchains and domain profiles, but can never dilute or override Tier 1 directives.
- Tier 2 strong defaults require explicit ADR references in `tier_overrides`.

---

## 2. Prime Directives (P1 – P10)
1. **P1: Deterministic Monorepo Orchestration**: All subprojects implement standard Nx target contracts (`lint`, `test`, `build`, `audit`).
2. **P2: Hierarchical Governance via AGENT.md**: Every subproject declares its scope, profile, stack, and invariants.
3. **P3: Strict Architectural Boundary Isolation**: Pure domain logic remains 100% free of external framework, ORM, and transport dependencies.
4. **P4: Value-Driven & Real-World Testing**: Integration tests run against real ephemeral containers (Podman/Testcontainers); engine substitutions (e.g. SQLite for PostgreSQL) are strictly forbidden.
5. **P5: Impact Before Implementation (Change Surface)**: Non-trivial changes require a validated `CHANGE_SURFACE.md` artifact.
6. **P6: 2-Pass PR Self-Audit & Zero-Drift Gates**: All changes undergo double-pass automated diff inspection before merge.
7. **P7: Complete Documentation & NC Transparency**: Missing business requirements are registered as `NEED_CLARIFICATION` items. Open items $\ge 14$ days mechanically block merges.
8. **P8: Sovereign & Zero-Trust Infrastructure**: All datastores, message streaming, and wire contracts enforce UTC ISO-8601 timestamps and zero-trust boundaries.
9. **P9: Structural Bounding & Anti-Sprawl Hygiene**: Hard ceiling of $\le 800$ lines per file (soft target $\le 400$); directory depth $\le 6$ levels; zero generic dumping grounds (`utils/`, `helpers/`, `misc/`).
10. **P10: Zero-Downtime Evolution & Distributed Integrity**: Database migrations follow Expand/Contract patterns; mutating endpoints enforce `Idempotency-Key`.

---

## 3. Architectural Profiles
- **Profile A (Backend & Core Services)**: Domain-Driven Design (DDD) + Hexagonal Architecture (Ports & Adapters). Pure C# 14 / .NET 10 domain logic.
- **Profile B (Web Applications)**: Developer Portal. Clean Component & State Layering, SSR/SPA hydration safety, WCAG 2.2 AA accessibility, Apple Design principles.
- **Profile C (Mobile Clients)**: Native & Cross-Platform (iOS, Android, Flutter). Offline-first sync with SQLite replica, hardware-backed secure storage.
- **Profile D (Shared Contracts & SDKs)**: Contract-first OpenAPI 3.1 specifications, strict SemVer, zero ambient side-effects.

---

## 4. LocalMe Sovereign Iran-Native & Global Runtime Invariants
1. **Consolidated Pure .NET 10 Stack**: Every server engine runs on .NET 10 + PostgreSQL 18.1 + Redis 7/8 with zero external runtime binaries.
2. **Currency Standard**: All monetary values are stored and calculated as exact **Iranian Rials (`IRR`)** using 64-bit integer (`BIGINT`) representations in `RialAmount`. Toman is used exclusively for presentation formatting.
3. **Regulatory Layer**: Automated e-Namad dynamic text and meta injection, fallback Persian storefront, and Static Egress NAT Gateway IP pooling for domestic banking and SMS providers.
4. **Domestic Resiliency**: Dual-mode push notifications (FCM/APNs + domestic MQTT-over-WebSocket) with client-side deduplication ring buffer.
5. **Zero WAL Logical Replication**: Single database isolation via schema partitioning (`control_plane`, `prj_{slug}`, `billing`, `analytics`) with application-level CDC and `LISTEN/NOTIFY`.

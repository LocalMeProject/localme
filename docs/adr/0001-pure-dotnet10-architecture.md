---
id: "ADR-0001"
title: "Consolidated Pure .NET 10 Stack with PostgreSQL 18.1 and Redis"
status: "Accepted"
date: "2026-10-15"
deciders:
  - "Sina Vali"
  - "LocalMe Core Architecture Team"
affected_projects:
  - "apps/server"
  - "libs/core-domain"
  - "libs/data-plane"
  - "libs/infrastructure"
tier_override: false
---

# ADR-0001: Consolidated Pure .NET 10 Stack with PostgreSQL 18.1 and Redis

## 1. Context and Problem Statement
Earlier architecture prototypes relied on heterogeneous polyglot engines: Envoy Edge Proxy, PostgREST + PgBouncer, Rust deno_core V8, NATS JetStream, Dragonfly Cache, ClickHouse, EMQX, ImgProxy, and CoreDNS. This produced severe operational friction, high container sprawl, complex orchestration requirements, and incompatibility with Iranian domestic hosting providers (e.g. Runflare, ArvanCloud).

## 2. Decision Drivers
- Operational simplicity: single container deployability and single-language maintainability in C# 14 / .NET 10.
- High performance: Kestrel Dynamic SNI, YARP reverse proxy, Npgsql multiplexing, zero-allocation JSON streaming via `System.IO.Pipelines`.
- Full compatibility with managed PostgreSQL (18.1) and Redis (7/8) on domestic cloud platforms.
- Strict isolation and regulatory compliance (e-Namad, Shaparak, Iranian IP tagging).

## 3. Considered Options
- **Option 1**: Multi-binary heterogeneous stack (Rust + Go + Envoy + NATS + ClickHouse + PostgREST).
- **Option 2**: Consolidated Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8 modular monolith architecture.
- **Option 3**: Node.js / TypeScript microservices with MongoDB / Kafka.

## 4. Decision Outcome
**Chosen Option**: Option 2 (Consolidated Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8). All edge routing, dynamic SQL endpoints, pub/sub, real-time messaging, and worker queues run in-process or within role-based instances of the same modular monolith binary.

## 5. Consequences
### Positive Consequences
- Drastically reduced memory footprint and operational complexity.
- Single build and deployment pipeline using standard .NET tooling.
- Zero external binary dependencies for core runtime operations.
- Native high-performance memory management with C# 14 spans and ref structs.

### Negative Consequences / Trade-Offs
- Analytical throughput on PostgreSQL BRIN partitioned tables is lower than dedicated ClickHouse for massive billion-row scans; accepted given target scale.
- JavaScript compute executes in managed Jint by default, trading pure V8 JIT speed for GC safety and sub-10ms cold starts.

### Neutral Consequences
- All developers work primarily in C#/.NET 10 for backend and data-plane modules.

## 6. Compliance & Verification Strategy
- **Automated Verification**: Architecture tests ensuring no external native binaries or out-of-process brokers are required.
- **Test Implementation**: `LocalMe.Core.Tests` and `LocalMe.Integration.Tests`.
- **Review Checkpoint**: Enforced via PR audit and architecture gatekeeper checks.

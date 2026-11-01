---
id: "ADR-0005"
title: "In-Process Dynamic SQL and Multi-Tenant DBaaS Engine"
status: "Accepted"
date: "2026-11-01"
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

# ADR-0005: In-Process Dynamic SQL and Multi-Tenant DBaaS Engine

## 1. Context and Problem Statement
Developers building applications on LocalMe require dynamic relational database capabilities (PostgREST-compatible REST queries, schema migrations, Row Level Security, indexing, foreign keys, and snapshot management). Traditional approaches rely on running external PostgREST Haskell daemons and PgBouncer connection multiplexers beside PostgreSQL. In resource-constrained domestic hosting environments (512MB–2GB RAM), managing out-of-process daemons per tenant or globally creates container sprawl, connection starvation, and memory exhaustion under high throughput (> 1,000,000 requests/day).

## 2. Decision Drivers
- **Zero External Daemons**: Dynamic PostgREST-style AST compilation and execution must run strictly in-process inside ASP.NET Core 10 / Npgsql.
- **Strict Tenant Schema Sandboxing**: Dynamic DML queries must be strictly isolated to the tenant's PostgreSQL schema (`prj_{slug}`) with active guardrail rejection of unauthorized DDL or catalog inspection.
- **Resource Boundedness**: Memory caching for schema metadata must be strictly bounded (`MemoryCache` with `SizeLimit = 1000` and sliding expiration) to prevent memory leakage under continuous 1M+ req/day traffic.
- **High-Performance Native Types**: PostgreSQL types (`bool`, `bigint`, `uuid`, `timestamptz`, `jsonb`) must map directly to JSON primitives without string-flattening or SQL operator mismatch errors (`42883`, `42804`).
- **Connection Security**: Zero PostgreSQL connection strings may ever be leaked to client SDKs or browsers; all operations flow through signed API gateway endpoints with JWT claims mapped to `auth.uid()` and `auth.role()`.

## 3. Considered Options
- **Option 1**: External PostgREST sidecar containers + PgBouncer pooler per tenant or globally.
- **Option 2**: In-process AST compiler (`SqlAstQueryCompiler`), guardrail gate (`SqlGuardrailValidator`), and tenant schema store (`PostgreSqlTenantSchemaStore`) running directly in ASP.NET Core 10.
- **Option 3**: Entity Framework Core dynamic model builders and scaffolding at runtime.

## 4. Decision Outcome
**Chosen Option**: Option 2.
- **AST Query Compiler**: Parses URL query parameters (`select`, PostgREST operators `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `not.*`, `in`, `is`) and JSON filter trees into parameterized SQL.
- **Guardrail Gate**: Strips comments and string literals, anchoring checks (`\bCOMMENT\s+ON\b`) to eliminate false positives while blocking forbidden DDL, privilege escalation, and OS escapes.
- **Value Converter & Store**: `PostgreSqlValueConverter` maps Npgsql reader fields directly to `JsonNode` primitives and binds typed parameters (`NpgsqlDbType.Jsonb`, etc.), eliminating type coercion failures.
- **Consolidated Metadata**: High-performance overview endpoint `GET /_baas/v1/{projectId}/db/tables/overview` queries catalogs and `pg_stat_user_tables` in a single roundtrip (<5ms), replacing $2 \times N$ API calls.
- **Snapshot Resiliency**: Multi-table snapshot restore executes with `session_replication_role = 'replica'` fallback to deferred constraints, guaranteeing foreign key consistency regardless of table ordering.

## 5. Consequences
### Positive Consequences
- Exceptional latency: sub-5ms query execution overhead over raw PostgreSQL.
- Deterministic memory envelope: bounded caching guarantees stable memory even under 1M+ requests/day on a 512MB instance.
- Seamless developer experience: Supabase/PostgREST compatible query syntax without managing Haskell processes.
- Full type safety for JSONB and complex structures.

### Negative Consequences / Trade-Offs
- Complex multi-level table joins (e.g. nested PostgREST resource embedding `select=*,orders(*,items(*))`) must be handled via explicit SQL queries or multi-step AST parsing.

## 6. Compliance & Verification Strategy
- **Unit Testing**: `SqlAstQueryCompilerTests` and `SqlGuardrailValidatorTests` verify operator parsing, literal stripping, and sanitization.
- **Integration Testing**: `PostgreSqlTenantSchemaStoreIntegrationTests` executed against real PostgreSQL 18.1 instances, validating real DDL, parameter binding, and snapshot replication roles.
- **Verification Command**: `dotnet test tests/LocalMe.Integration.Tests/` and `python3 scripts/ep.py verify`.

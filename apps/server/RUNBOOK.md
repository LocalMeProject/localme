# Operational Runbook: server

## 1. Service Overview
- **Service Name**: `server`
- **Owner Team**: Core Backend Services (`localme-platform`)
- **Repository Path**: `apps/server`
- **Architectural Profile**: Profile A (Backend Hexagonal & ASP.NET Core 10 Host)
- **Runtime Environment**: Containerized / Kestrel / Podman Quadlet / Runflare
- **Upstream Dependencies**: Ingress Proxy / Shetab IPG gateways / Client SDKs
- **Downstream Dependencies**: PostgreSQL, Redis / In-memory storage, SMS providers

---

## 2. Health & Readiness Probes
- **Liveness Probe**: `GET /healthz` (Port 5000 / 8080)
  - Threshold: Fails if Kestrel hangs or runtime process deadlocks.
  - Expected Response: `200 OK` `{"status":"ok"}`
  - Remediation on Failure: Automatic container restart.
- **Readiness Probe**: `GET /readyz`
  - Threshold: Fails if database or storage pool is disconnected.
  - Expected Response: `200 OK` `{"status":"ready"}`
  - Remediation on Failure: Traffic removed from load balancer pool.

---

## 3. Golden Signals & Alerting Thresholds
| Metric | Target / SLO | Warning Threshold | Critical / Pager Threshold | Dashboard Link |
|---|---|---|---|---|
| **Latency (p95)** | <= 100ms | > 200ms for 5m | > 500ms for 2m | Grafana Dashboard |
| **Error Rate (5xx)** | < 0.1% | > 0.5% for 5m | > 1.0% for 2m | Grafana Dashboard |
| **Traffic / RPS** | Normal: 100-2000 rps | < 10 rps or > 4000 rps | > 8000 rps | Grafana Dashboard |
| **Saturation** | CPU < 70%, Mem < 80% | Mem > 80% | Mem > 90% (OOM risk) | Grafana Dashboard |

---

## 4. Common Failure Modes & Step-by-Step Remediation
### 4.1. Database Connection Starvation
- **Symptoms**: Readiness probe fails (`readyz` 503), logs show database pool timeouts.
- **Diagnosis**: Query active connections and locks on PostgreSQL.
- **Mitigation**: Drain idle connections and scale out read connections.

### 4.2. Shetab IPG Gateway Timeouts
- **Symptoms**: Payment verification spikes with timeout exceptions.
- **Diagnosis**: Inspect PSP upstream status (Zarinpal/Magfa).
- **Mitigation**: Enable mock gateway fallback in sandbox mode or switch to alternative PSP.

### 4.3. DBaaS Multi-Tenant Connection Starvation & Catalog Lockups
- **Symptoms**: Tenant API requests return `503 Service Unavailable` with `55P03: lock not available` or latency spikes on `_baas/v1/{projectId}/rest/*`.
- **Diagnosis**: 
  1. Inspect active locks and long-running DDL transactions:
     ```sql
     SELECT pid, age(clock_timestamp(), query_start), usename, query, state 
     FROM pg_stat_activity 
     WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
     ORDER BY query_start ASC;
     ```
  2. Inspect blocked queries:
     ```sql
     SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid,
            blocked_activity.query AS blocked_statement, blocking_activity.query AS blocking_statement
     FROM pg_catalog.pg_locks blocked_locks
     JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
     JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
     JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
     WHERE NOT blocked_locks.granted;
     ```
- **Mitigation**:
  1. Terminate offending blocking queries: `SELECT pg_terminate_backend(blocking_pid);`
  2. Ensure schema cache eviction via `PostgreSqlTenantSchemaStore.InvalidateTenantSchemaCache(projectSlug)` if schema DDL was interrupted.
  3. Verify Npgsql connection pool max size (`Maximum Pool Size=100`) and idle timeout (`Connection Idle Lifetime=15`).

### 4.4. Snapshot Maintenance & Data Plane Restore
- **Symptoms**: Snapshot restore fails with `23503: foreign key constraint violation` or out-of-order table truncation.
- **Diagnosis**: Examine restore logs for circular foreign key constraints or active connections holding `ACCESS EXCLUSIVE` locks on the tenant schema.
- **Mitigation**:
  1. Restores automatically set `SET LOCAL session_replication_role = 'replica';` to disable foreign key verification during data re-population.
  2. If using standard roles without superuser bypass, ensure all dependent child tables are deferred via `SET CONSTRAINTS ALL DEFERRED;`.
  3. Purge orphaned or test snapshots periodically from S3/MinIO bucket `localme-dbaas-snapshots`.

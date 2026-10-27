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

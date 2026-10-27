# Operational Runbook: web-console

## 1. Service Overview
- **Service Name**: `web-console`
- **Owner Team**: Frontend & Product Experience (`localme-frontend`)
- **Repository Path**: `apps/web-console`
- **Architectural Profile**: Profile B (Web Application / Developer Console)
- **Runtime Environment**: Static SPA / Vite / CDN / ASP.NET Core wwwroot
- **Upstream Dependencies**: Web Browsers / Cloudflare CDN
- **Downstream Dependencies**: LocalMe Server BaaS APIs (`/_baas/v1/*`)

---

## 2. Health & Readiness Probes
- **Liveness Probe**: HTTP `GET /index.html` or static asset bundle availability
  - Expected Response: `200 OK`.
- **Readiness Probe**: API Gateway reachability check
  - Threshold: Fails if static assets cannot load or API endpoints return CORS/network errors.

---

## 3. Golden Signals & Alerting Thresholds
| Metric | Target / SLO | Warning Threshold | Critical / Pager Threshold | Dashboard Link |
|---|---|---|---|---|
| **Core Web Vitals (LCP)** | < 2.5s | > 3.0s | > 4.0s | Real User Monitoring (RUM) |
| **Core Web Vitals (CLS)** | < 0.1 | > 0.15 | > 0.25 | RUM |
| **Client JS Error Rate** | < 0.05% | > 0.2% | > 1.0% | Sentry Dashboard |

---

## 4. Common Failure Modes & Step-by-Step Remediation
### 4.1. Static Asset CDN Cache Invalidation
- **Symptoms**: Users report outdated UI or bundle mismatch errors.
- **Mitigation**: Trigger CDN cache purge for hashed assets and verify `/index.html` cache headers (`no-cache`).

### 4.2. API Gateway CORS or Authentication Rejection
- **Symptoms**: Console shows 401 Unauthorized or CORS errors on all API calls.
- **Mitigation**: Verify JWT expiration and check `AllowedOrigins` in `apps/server/src/Program.cs`.

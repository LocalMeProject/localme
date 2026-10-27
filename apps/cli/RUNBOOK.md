# Operational Runbook: cli

## 1. Service Overview
- **Service Name**: `cli`
- **Owner Team**: Core Infrastructure & Developer Experience (`localme-devs`)
- **Repository Path**: `apps/cli`
- **Architectural Profile**: Profile A (Backend Core CLI tool)
- **Runtime Environment**: Standalone .NET 10 Console binary
- **Upstream Dependencies**: LocalMe Server / HTTP Gateway APIs
- **Downstream Dependencies**: Core domain DAG engine, standard I/O

---

## 2. Health & Readiness Probes
- **Liveness Probe**: CLI process exit code verification
  - Threshold: Fails on non-zero exit code or uncaught exceptions.
  - Expected Response: Exit Code `0`.
- **Readiness Probe**: Target API endpoint accessibility (`--ping` or `--check`)
  - Remediation on Failure: Check network connectivity to `LocalMe.Server`.

---

## 3. Golden Signals & Alerting Thresholds
| Metric | Target / SLO | Warning Threshold | Critical / Pager Threshold | Dashboard Link |
|---|---|---|---|---|
| **Execution Latency** | <= 500ms | > 1s | > 3s | Internal Diagnostics |
| **Error Rate** | < 0.1% | > 1.0% | > 5.0% | Internal Diagnostics |

---

## 4. Common Failure Modes & Step-by-Step Remediation
### 4.1. Server Connectivity Failure
- **Symptoms**: CLI commands timeout or return 503/connection refused.
- **Remediation**: Check `LOCALME_SERVER_URL` environment variable and confirm `apps/server` is listening.

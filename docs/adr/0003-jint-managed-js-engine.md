---
id: "ADR-0003"
title: "Jint 4.x as Default Managed JavaScript Runtime with ClearScript.V8 Opt-In"
status: "Accepted"
date: "2026-10-15"
deciders:
  - "Sina Vali"
  - "LocalMe Core Architecture Team"
affected_projects:
  - "libs/data-plane"
  - "apps/server"
tier_override: false
---

# ADR-0003: Jint 4.x as Default Managed JavaScript Runtime with ClearScript.V8 Opt-In

## 1. Context and Problem Statement
LocalMe provides serverless function compute (`COMPUTE_EDGE`) for SMS dispatches (MeliPayamak, Kavenegar), KYC verification (Shahkar), and durable workflows. In shared hosting and managed container environments, embedding native V8 engines (`libClearScriptV8.so`) risks unmanaged heap exhaustion and container OOM kills.

## 2. Decision Drivers
- Memory safety: 100% managed .NET memory visible to the garbage collector.
- Fine-grained memory governor: strict 16MB default memory ceiling and 5s execution timeouts.
- Deterministic sub-10ms cold start for webhook and OTP scripts.
- Portability across Linux distributions without native shared library dependencies.

## 3. Considered Options
- **Option 1**: Microsoft.ClearScript.V8 exclusively across all deployments.
- **Option 2**: External Node.js / Deno runner via gRPC / HTTP sidecars.
- **Option 3**: Jint 4.x managed interpreter by default, with ClearScript.V8 opt-in for dedicated nodes.

## 4. Decision Outcome
**Chosen Option**: Option 3 (Jint 4.x default, ClearScript.V8 opt-in). Jint provides memory-isolated, pure managed script execution with zero native library dependencies.

## 5. Consequences
### Positive Consequences
- Zero unmanaged memory leak risks in shared hosting environments.
- Instant cold start from warm pooled engines.
- Strict timeout and memory enforcement via Jint constraints.

### Negative Consequences / Trade-Offs
- Jint does not support native V8 JIT compilation or WebAssembly; acceptable for target lightweight dispatch scripts.

### Neutral Consequences
- High-compute workloads opt into dedicated worker nodes with V8 feature flags.

## 6. Compliance & Verification Strategy
- **Automated Verification**: Jint sandbox unit and integration tests enforcing memory limits and timeout exceptions.
- **Test Implementation**: `LocalMe.DataPlane` compute tests.
- **Review Checkpoint**: Architecture reviews verify script isolation boundaries.

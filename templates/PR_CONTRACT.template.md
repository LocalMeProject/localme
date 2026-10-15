## Description
<!-- Provide a clear, high-level summary of the changes and motivation -->
- **Type**: `[feat | fix | refactor | chore | test | perf]`
- **Scope**: `[project-or-module]`
- **Related Issues**: Closes #[issue-number]

---

## Change Surface Reference
- **Change Surface Document**: `[path/to/CHANGE_SURFACE.md or link]`
- **Affected Projects**:
  - `[project-path-1]`
  - `[project-path-2]`

---

## 10-Dimension Self-Audit Verification

### Pass 1: Diff Audit (Self-Audit & Remediation)
- [ ] **1. Scalability & Capacity**: No unbounded queries, memory leaks, or $O(n^2)$ bottlenecks; connection pooling configured.
- [ ] **2. Structural Modularity**: Profile rules satisfied; file sizes $\le 800$ lines; directory depth $\le 6$; anti-sprawl co-location; no dumping grounds.
- [ ] **3. Fault Tolerance**: Timeouts configured on all network boundaries; retries have jitter; graceful shutdown on `SIGTERM`.
- [ ] **4. Data Integrity**: Optimistic/pessimistic concurrency; UTC Storage Convention; Expand/Contract migrations; Transactional Outbox for events.
- [ ] **5. Security & Zero-Trust**: Parameterized queries; zero credentials; multi-tenancy isolation; supply chain lockfiles immutable.
- [ ] **6. Observability**: Structured JSON logging; distributed trace propagation; PII/secret scrubbing enabled.
- [ ] **7. Contract & Schema Drift**: OpenAPI/Protobuf contracts synchronized; no unversioned breaks.
- [ ] **8. Code Quality**: Strict typing; no `any`; no swallowed errors.
- [ ] **9. Documentation & Spec Drift**: Change Surface adhered to; ADR attached if Tier 2 overridden.
- [ ] **10. Test Fidelity**: Real ephemeral containers used (no engine substitution); failure paths tested; $\ge 95\%$ domain coverage.

### Pass 2: Cumulative Diff & CI Verification
- [ ] `nx affected --target=lint` passed with 0 errors.
- [ ] `nx affected --target=test` passed (Domain coverage $\ge 95\%$, Adapters $\ge 80\%$).
- [ ] `nx affected --target=build` passed with 0 errors.
- [ ] `python3 scripts/verify-nx-targets.py` passed.
- [ ] `python3 scripts/verify-agent-manifests.py` passed.
- [ ] `python3 scripts/check-nc-items.py --max-age 14` confirmed 0 blocking NC items.

---

## Mechanical Gate Status
- [ ] **Pass 1 Clean**: 0 blocking defects.
- [ ] **Pass 2 Clean**: 0 blocking defects.
- [ ] **CI Green**: All workflows succeeded.
- [ ] **Merge Ready**: Ready for automated squash merge (`gh pr merge --squash`).
- [ ] **Escalation**: Label `needs/review` attached if human sign-off or branch protection required.

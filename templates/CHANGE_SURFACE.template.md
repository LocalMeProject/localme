---
title: "Change Surface: [Short Descriptive Title]"
author: "[Author or Agent ID]"
created_date: "YYYY-MM-DD"
target_branch: "main"
risk_level: "LOW"                    # LOW | MEDIUM | HIGH | CRITICAL
affected_projects:
  - "services/billing-service"
  - "libs/core-contracts"
---

# Change Surface: [Feature or Task Title]

## 1. Intent & Business Rationale
[Provide a clear, unambiguous statement of why this change is needed, what problem it solves, and the expected business outcome.]

## 2. Affected Monorepo Projects & Profiles
| Project Path | Architectural Profile | Responsibility in this Change |
|---|---|---|
| `services/billing-service` | Profile A (DDD/Hexagonal) | Update invoice recalculation aggregate |
| `libs/core-contracts` | Profile D (Contracts) | Add DiscountApplied event schema |

## 3. Code Surface (Targeted Symbols & Files)
Declare the exact files and symbols that will be modified or created. Modifying files outside this surface requires updating this document.

### Added Files
- `services/billing-service/src/domain/entities/discount.ts`: Discount value object and validation logic.
- `services/billing-service/src/application/use-cases/apply-discount.ts`: Command handler applying discount to aggregate.

### Modified Files
- `services/billing-service/src/domain/entities/invoice.ts`: Add `applyDiscount` method enforcing maximum 50% discount invariant.
- `libs/core-contracts/schemas/openapi/billing.yaml`: Add discount query parameters to invoice calculation endpoint.

## 4. Test Surface
Every code change must have a corresponding test surface. Happy-path-only tests are prohibited.

### Unit & Domain Tests
- `services/billing-service/tests/unit/domain/discount.spec.ts`: Value object validity, negative amounts, percentage bounds.
- `services/billing-service/tests/unit/domain/invoice.spec.ts`: Invariant enforcement, event emission.

### Integration Tests (Real Ephemeral Containers)
- `services/billing-service/tests/integration/persistence/invoice-repository.test.ts`: Ephemeral PostgreSQL container test verifying invoice state update and transaction commit.

### Failure & Resilience Tests
- `services/billing-service/tests/integration/resilience/discount-timeout.test.ts`: Upstream discount service timeout handling and circuit breaker activation.

### Concurrency Tests
- `services/billing-service/tests/integration/concurrency/concurrent-discount.test.ts`: Concurrent discount application attempts; optimistic lock verification.

## 5. Invariants & Non-Negotiables Preserved
- [ ] Tier 1: Pure domain logic remains 100% free of framework or ORM imports.
- [ ] Tier 1: Real container integration tests (no engine-substitution emulators like SQLite for Postgres).
- [ ] Tier 1: All stored and wire timestamps use UTC ISO-8601 (`Z`).
- [ ] Tier 1: Directory nesting depth does not exceed 6 levels from project root.
- [ ] Tier 1: Database migrations follow Expand/Contract pattern for zero-downtime rollout.
- [ ] Tier 2: Files respect size ceilings ($\le 800$ lines hard, $\le 400$ lines soft); no micro-file sprawl.
- [ ] Tier 2: Domain test coverage maintains $\ge 95\%$ line & branch coverage; adapters $\ge 80\%$.
- [ ] Tier 2: Transactional outbox pattern used for domain events published to brokers.
- [ ] Tier 2: Backward compatibility of existing API contracts preserved.

## 6. Risk Matrix & Rollback Strategy
| Risk Description | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Concurrent updates causing discount race condition | Medium | High | Optimistic concurrency control on Invoice aggregate version |
| Slow database query under high load | Low | Medium | Indexed lookup on `(tenant_id, invoice_id)` |

### Rollback Strategy
[Describe the precise steps to revert this change if defects are detected post-deployment (e.g., database migration down script, feature flag toggle, deployment reversion).]

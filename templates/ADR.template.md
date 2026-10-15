---
id: "ADR-NNNN"
title: "[Short Title of Decision]"
status: "Proposed"                    # Proposed | Accepted | Superseded | Rejected
date: "YYYY-MM-DD"
deciders:
  - "[Architect / Engineer 1]"
  - "[Agent ID]"
affected_projects:
  - "[project-path-1]"
tier_override: false                  # true if this ADR justifies a Tier 2 strong default deviation
---

# ADR-NNNN: [Short Title of Decision]

## 1. Context and Problem Statement
[Describe the context and problem statement in plain terms. What architectural challenge or technology choice are we addressing?]

## 2. Decision Drivers
- [Driver 1: e.g., Need sub-millisecond read latency for hot billing sessions]
- [Driver 2: e.g., Maintain self-hosted portability without proprietary cloud vendor lock-in]
- [Driver 3: e.g., Comply with Tier 1 pure domain isolation standards]

## 3. Considered Options
- **Option 1**: [Description of Option 1]
- **Option 2**: [Description of Option 2]
- **Option 3**: [Description of Option 3]

## 4. Decision Outcome
**Chosen Option**: [Option 1], because [clear, concise rationale explaining why this option was chosen over the alternatives].

### Justification for Tier 2 Deviation (if applicable)
[If this ADR overrides a Tier 2 strong default, explicitly explain why the default is inappropriate in this specific context and how risk is mitigated.]

## 5. Consequences

### Positive Consequences
- [Positive outcome 1]
- [Positive outcome 2]

### Negative Consequences / Trade-Offs
- [Accepted drawback or trade-off 1]
- [Accepted drawback or trade-off 2]

### Neutral Consequences
- [Operational or organizational impact]

## 6. Compliance & Verification Strategy
- **Automated Verification**: [Which linter, test, or CI check ensures this decision is adhered to mechanically?]
- **Test Implementation**: [Which test suite validates the invariant introduced by this decision?]
- **Review Checkpoint**: [How will future changes be evaluated against this ADR?]

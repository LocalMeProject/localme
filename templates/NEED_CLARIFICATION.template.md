---
id: "NC-YYYYMMDD-001"
status: "OPEN"                        # OPEN | RESOLVED | ABANDONED
created_date: "YYYY-MM-DD"            # Format: YYYY-MM-DD
resolved_date: null
discovered_by: "[Agent ID or Contributor]"
severity: "blocking"                 # blocking | non-blocking
affected_projects:
  - "[project-path-1]"
---

# NEED_CLARIFICATION: [Clear Descriptive Title]

## 1. Context & Trigger
[Explain where, when, and how this ambiguity was discovered. Cite the specific requirement, code path, or user story that led to this question.]

## 2. Unresolved Question
[State the exact business, architectural, or domain question that requires human/domain clarification. Be precise and avoid vague phrasing.]

## 3. Options Considered

### Option A: [Title of Option A]
- **Description**: [How this option works]
- **Pros**:
  - [Pro 1]
  - [Pro 2]
- **Cons**:
  - [Con 1]
  - [Con 2]
- **Impact on Timeline / Architecture**: [Estimated impact]

### Option B: [Title of Option B]
- **Description**: [How this option works]
- **Pros**:
  - [Pro 1]
  - [Pro 2]
- **Cons**:
  - [Con 1]
  - [Con 2]
- **Impact on Timeline / Architecture**: [Estimated impact]

## 4. Resolution & Decision
*(Leave empty while status is OPEN. To be filled upon resolution)*
- **Selected Option**: [Option A / Option B / Alternative]
- **Decision Rationale**: [Why this decision was selected]
- **Decided By**: [Product Owner / Lead Architect Name]
- **Date Decided**: [YYYY-MM-DD]
- **Associated ADR**: [Link to ADR if applicable, e.g. docs/adr/0042.md]

## 5. Escalation Log
- YYYY-MM-DD: Discovered during [Phase/Task]. Status set to OPEN.
- [Automated]: If unresolved by Day 14, automated PR blocking is activated across affected projects.

---
id: "ADR-0006"
title: "PostgreSQL Centralization and Legacy Table Contract Decommissioning"
status: "Accepted"
date: "2026-11-05"
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

# ADR-0006: PostgreSQL Centralization and Legacy Table Contract Decommissioning

## 1. Context and Problem Statement
LocalMe initially stored dynamic tenant database rows in a centralized key-value or document-like table named `project_table_records`. Under ADR-0005, all tenant database structures and records were migrated into isolated PostgreSQL schema-per-tenant (`prj_{slug}.*`). Additionally, Redis caching and queue dependencies introduced operational brittleness, data-loss risks on restarts, and increased RAM footprints for early-stage deployments.

## 2. Decision Drivers
- **Contract Cleanup Phase**: Phased deprecation of the obsolete `project_table_records` table, as all production tenant data resides exclusively inside individual tenant schemas (`prj_{slug}`).
- **Zero External Broker Dependency**: Full elimination of Redis in favor of PostgreSQL-native transactional primitives (`FOR UPDATE SKIP LOCKED` for push queues, `LISTEN/NOTIFY` for cluster cache invalidation, and unlogged tables for ephemeral SMS OTPs).
- **Universal Project Portability**: Introduction of `.localmepack` universal archives for cloning, restoring, and self-contained LocalMeLite environments.

## 3. Decision Outcome
1. **Contract Execution**: `DROP TABLE IF EXISTS project_table_records CASCADE;` is formally approved for Phase 5 decommission.
2. **PostgreSQL Outbox Push Queue**: Dequeueing is handled via `push_jobs` with `SKIP LOCKED`.
3. **Cluster Bus**: Inter-node cache invalidation uses pointer-only triggers (`localme_cluster_bus`).
4. **Project Archives**: Implemented `ProjectArchiveService` supporting gzip and raw JSON streams with 3 restore modes (`CloneAsNew`, `RestoreOverwrite`, `RestoreMerge`).

## 4. Consequences
### Positive Consequences
- Zero Redis dependencies across the entire code tree.
- Full compatibility with rolling zero-downtime updates and single-container deployments.
- Clean separation between tenant data spaces and platform control plane.

---
id: "ADR-0004"
title: "Mandatory IBlobStorageAdapter Layer for Multi-Provider Portability"
status: "Accepted"
date: "2026-10-15"
deciders:
  - "Sina Vali"
  - "LocalMe Core Architecture Team"
affected_projects:
  - "libs/core-domain"
  - "libs/data-plane"
  - "apps/server"
tier_override: false
---

# ADR-0004: Mandatory IBlobStorageAdapter Layer for Multi-Provider Portability

## 1. Context and Problem Statement
Storing user files, APK releases, and static SPA deployment bundles inside PostgreSQL or local filesystem creates storage bloat and prevents seamless scaling. Furthermore, different domestic (Runflare, ArvanCloud, ParsPack) and global (AWS S3, Cloudflare R2, MinIO) object storage services have distinct endpoint behaviors.

## 2. Decision Drivers
- Vendor neutrality: zero hard-coded dependencies on proprietary cloud APIs.
- Seamless provider switching per project via configuration without code changes.
- Support for resumable uploads (TUS v1.0.0) and on-the-fly media transformations (ImageSharp).

## 3. Considered Options
- **Option 1**: Direct AWS S3 SDK coupled throughout application handlers.
- **Option 2**: PostgreSQL `BYTEA` storage for small assets.
- **Option 3**: Unified `IBlobStorageAdapter` interface with pluggable implementations (Runflare, ArvanCloud, MinIO, S3, LocalDisk).

## 4. Decision Outcome
**Chosen Option**: Option 3 (Unified `IBlobStorageAdapter`). All storage operations (put, get, delete, head, presigned URLs, multipart) operate against the abstraction layer.

## 5. Consequences
### Positive Consequences
- Projects switch storage providers (e.g. from LocalDisk in dev to Runflare or Arvan in prod) by updating project settings.
- Standard compliance test suite validates all adapter implementations against the same contract.
- LocalDisk adapter facilitates zero-dependency local development and testing.

### Negative Consequences / Trade-Offs
- Advanced provider-specific proprietary features are abstracted away in favor of universal S3-compatible semantics.

### Neutral Consequences
- All object access goes through project-scoped bucket and prefix resolution.

## 6. Compliance & Verification Strategy
- **Automated Verification**: Adapter compliance test battery executed in CI.
- **Test Implementation**: `LocalMe.Integration.Tests` storage test suite.
- **Review Checkpoint**: Any new storage provider must implement `IBlobStorageAdapter` and pass compliance tests.

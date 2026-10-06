---
id: repo:localme/flows/ssl-provision
title: SSL Provisioning Flow
level: repo
kind: contract
domains:
  - platform
  - projects
flows:
  - domain:ssl-provision
keywords:
  - ssl
  - acme
  - let's encrypt
  - certificates
implements:
  - domain:ssl-provision
---

# SSL Provisioning Flow

## Purpose
Automates the request and renewal of SSL certificates via ACME HTTP-01 challenges for custom domains attached to projects.

## Participants
- **projects**: Maintains the custom domains that require certificates.
- **platform**: Runs the ACME client, responds to `/.well-known/acme-challenge/`, and schedules renewals via cron.

## Steps
1. An operator enables `ssl.auto_provision`.
2. The cron job `renew_ssl_certificates` triggers every 6 hours.
3. The platform finds domains lacking certificates or expiring within `ssl.renewal_days_before_expiry` (default: 30 days).
4. For each domain, it initiates an HTTP-01 challenge with the ACME provider.
5. The provider hits `/.well-known/acme-challenge/<token>`.
6. The platform serves the token.
7. Upon verification, the certificate is downloaded and stored in the database/storage.

## Domain References
- `repo:localme/operational/cron`: Defines platform scheduled tasks.

## Failure Modes
- DNS not pointing to the platform (challenge fails).
- Let's Encrypt rate limits reached.

## Change Entry Point
This doc is the entry point for any change that touches this flow. Start impact discovery here.

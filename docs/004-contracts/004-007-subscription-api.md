---
id: repo:localme/contracts/subscription-api
parent: repo:localme/contracts
title: Subscription API Contract
level: repo
kind: contract
parties: [client, billing-service]
domains:
  - platform
keywords:
  - subscription
  - billing
  - tiers
  - plans
---

# Subscription API Contract

Handles dynamic multi-tier subscriptions and quota enforcement for projects.

## Endpoints

- `GET /api/subscription/plans` - Retrieves available subscription tiers and their respective limits (e.g., storage quotas, bandwidth, allowed domains).
- `POST /api/subscription/checkout` - Initiates a billing checkout session for a selected tier.
- `POST /api/subscription/callback` - Webhook callback from the payment provider to update the project's subscription state upon successful payment.

Subscriptions automatically adjust the limits enforced by the platform during file uploads (`/api/storage`) and traffic bandwidth monitoring.

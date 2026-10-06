---
id: repo:localme/flows/webhook-delivery
title: Webhook Delivery Flow
level: repo
kind: contract
domains:
  - platform
  - data
flows:
  - webhook:delivery
keywords:
  - webhooks
  - outbox
  - retries
implements:
  - webhook:delivery
---

# Webhook Delivery Flow

## Purpose
Ensures reliable delivery of system and data events to external endpoints using an outbox pattern and HMAC signatures.

## Participants
- **data**: Generates database modification events.
- **platform**: Processes the outbox, fires HTTP requests, and manages the retry schedule.

## Steps
1. An event triggers within the platform (e.g., a document is created).
2. The event is written to a transactional webhook outbox in the database.
3. An asynchronous worker or cron job reads pending outbox messages.
4. The system calculates an HMAC signature using the project's webhook secret.
5. The HTTP request is sent to the target URL (preventing private/loopback addresses if `webhooks.allow_private_targets` is false).
6. If the request succeeds (2xx), the outbox entry is marked delivered.
7. If the request fails, the retry counter increments, and delivery is rescheduled based on `webhooks.retry_backoff_seconds` (if `webhooks.retry_failed` is enabled).

## Domain References
- `repo:localme/operational/cron`: Defines the built-in webhook retry job.

## Failure Modes
- Target endpoint is unreachable or returns 5xx.
- Maximum attempts exceeded (webhook is marked as failed permanently).

## Change Entry Point
This doc is the entry point for any change that touches this flow. Start impact discovery here.

-- Migration 005 (Postgres): durable webhook delivery queue.
-- SQLite twin: db/sqlite/005_webhook_outbox.sql (see db/README.md parity map).
--
-- §5.9 requires delivery to be "non-blocking: events are queued and processed by
-- a BackgroundService". Dispatch now writes a row here and a drainer delivers
-- it, so a crash mid-delivery loses nothing: the row stays `pending` and the
-- next drain picks it up.
--
-- `status` is pending | delivered | failed. Retries are OFF by default because
-- §5.9 states "Retry: No retries (as per requirement)"; enabling
-- webhooks.retry_failed switches the drainer to exponential backoff.

CREATE TABLE IF NOT EXISTS webhook_outbox (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload TEXT NOT NULL,
    signature TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON webhook_outbox (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_project ON webhook_outbox (project_id, id);

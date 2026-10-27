-- ==============================================================================
-- Enterprise Transactional Outbox Schema Template
-- Profile: A (Backend & Core Services)
-- Standard: Expand/Contract Zero-Downtime Migration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at_utc TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    published_at_utc TIMESTAMPTZ NULL,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT NULL
);

-- Index for high-velocity polling of unpublished events
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed 
ON outbox_events (occurred_at_utc) 
WHERE published_at_utc IS NULL;

-- Index for aggregate historical event querying / audit trail
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
ON outbox_events (aggregate_type, aggregate_id, occurred_at_utc);

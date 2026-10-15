-- LocalMe Analytics & Metering Schema (Section 6.3 SSOT)
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS billing;

-- Tenant Analytical Event Store (Partitioned by project_id)
CREATE TABLE IF NOT EXISTS analytics.tenant_events (
    project_id UUID NOT NULL,
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id TEXT,
    event_name TEXT,
    event_time TIMESTAMPTZ NOT NULL,
    client_ip INET,
    country_code CHAR(2),
    platform TEXT,
    app_version TEXT,
    properties_json JSONB,
    numeric_value DOUBLE PRECISION DEFAULT 0,
    PRIMARY KEY (project_id, event_time, event_id)
) PARTITION BY LIST (project_id);

-- Real-Time B2B Platform Metering Store
CREATE TABLE IF NOT EXISTS billing.usage_ledger_raw (
    project_id UUID NOT NULL,
    org_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    metric_type TEXT NOT NULL,
    quantity BIGINT NOT NULL DEFAULT 0
) PARTITION BY RANGE (recorded_at);

-- ==============================================================================
-- Migration: 005_DynamicPlatformConfigAndShards
-- Purpose: In-DB Runtime Configuration Store & Multi-Shard Catalog Engine
-- ==============================================================================

-- 1. Persistent Runtime Platform Configurations
CREATE TABLE IF NOT EXISTS platform_configurations (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(128) NOT NULL DEFAULT 'system'
);

-- 2. Platform Shards Catalog
CREATE TABLE IF NOT EXISTS platform_shards (
    id VARCHAR(32) PRIMARY KEY,              -- e.g. 'shard-a', 'shard-b'
    name VARCHAR(128) NOT NULL,
    connection_string TEXT NOT NULL,         -- encrypted or protected ADO.NET / URI
    region VARCHAR(64) NOT NULL DEFAULT 'ir-central',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_accepting_new_projects BOOLEAN NOT NULL DEFAULT TRUE,
    max_capacity_projects INT NOT NULL DEFAULT 5000,
    current_project_count INT NOT NULL DEFAULT 0,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure primary shard-a seed exists
INSERT INTO platform_shards (id, name, connection_string, region, is_active, is_accepting_new_projects, max_capacity_projects)
VALUES ('shard-a', 'Primary PostgreSQL Cluster (Default)', 'PRIMARY_CONNECTION', 'ir-central', true, true, 5000)
ON CONFLICT (id) DO NOTHING;

-- 3. Invalidation Triggers on Cluster Bus
CREATE OR REPLACE FUNCTION notify_cluster_event() RETURNS TRIGGER AS $$
DECLARE
    row_json jsonb;
    key_val text;
    payload jsonb;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_json := to_jsonb(OLD);
    ELSE
        row_json := to_jsonb(NEW);
    END IF;

    key_val := COALESCE(row_json->>'id', row_json->>'key', 'global');

    payload := jsonb_build_object(
        't', TG_TABLE_NAME,
        'a', TG_OP,
        'k', key_val
    );
    PERFORM pg_notify('localme_cluster_bus', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_configurations_invalidation ON platform_configurations;
CREATE TRIGGER trg_platform_configurations_invalidation
AFTER INSERT OR UPDATE OR DELETE ON platform_configurations
FOR EACH ROW EXECUTE FUNCTION notify_cluster_event();

DROP TRIGGER IF EXISTS trg_platform_shards_invalidation ON platform_shards;
CREATE TRIGGER trg_platform_shards_invalidation
AFTER INSERT OR UPDATE OR DELETE ON platform_shards
FOR EACH ROW EXECUTE FUNCTION notify_cluster_event();

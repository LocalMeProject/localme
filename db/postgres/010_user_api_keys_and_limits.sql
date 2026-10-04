-- Migration 010 (PostgreSQL): User-centered API keys, disk-based file storage metadata,
-- and per-user/per-project limits (replacing visit quotas).

-- 1. Per-user quota configuration on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_projects INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_storage_cap_bytes BIGINT DEFAULT 20971520;

-- 2. User-centered master API keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE api_keys ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encrypted_key TEXT;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Backfill user_id from project ownership
UPDATE api_keys
SET user_id = projects.user_id
FROM projects
WHERE api_keys.project_id = projects.id AND api_keys.user_id IS NULL;

-- 3. File storage off DB: content_blob becomes nullable, disk_path added
ALTER TABLE files ALTER COLUMN content_blob DROP NOT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS disk_path TEXT;

-- 4. System defaults for project limits
INSERT INTO system_configs (config_key, config_value, description)
VALUES ('limits.max_projects_per_user', '10', 'Default maximum number of projects allowed per user')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO system_configs (config_key, config_value, description)
VALUES ('limits.project_storage_cap_bytes', '20971520', 'Default storage size cap per project in bytes (20MB)')
ON CONFLICT (config_key) DO NOTHING;

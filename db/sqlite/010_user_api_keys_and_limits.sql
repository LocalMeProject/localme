-- Migration 010 (SQLite): User-centered API keys, disk-based file storage metadata,
-- and per-user/per-project limits (replacing visit quotas).

-- 1. Per-user quota configuration on users
ALTER TABLE users ADD COLUMN max_projects INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN project_storage_cap_bytes INTEGER DEFAULT 20971520;

-- 2. User-centered master API keys
CREATE TABLE api_keys_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    prefix TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '{}',
    encrypted_key TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT
);

INSERT INTO api_keys_new (id, project_id, name, key_hash, prefix, permissions, last_used_at, created_at, revoked_at)
SELECT id, project_id, name, key_hash, prefix, permissions, last_used_at, created_at, revoked_at FROM api_keys;

-- Backfill user_id from project ownership
UPDATE api_keys_new
SET user_id = (SELECT user_id FROM projects WHERE projects.id = api_keys_new.project_id)
WHERE project_id IS NOT NULL;

DROP TABLE api_keys;
ALTER TABLE api_keys_new RENAME TO api_keys;
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uq ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- 3. File storage off SQLite: content_blob becomes nullable, disk_path added
CREATE TABLE files_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_text INTEGER NOT NULL DEFAULT 1,
    content_text TEXT,
    content_blob BLOB,
    disk_path TEXT,
    size_bytes INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, path)
);

INSERT INTO files_new (id, project_id, path, is_text, content_text, content_blob, size_bytes, updated_at)
SELECT id, project_id, path, is_text, content_text, content_blob, size_bytes, updated_at FROM files;

DROP TABLE files;
ALTER TABLE files_new RENAME TO files;
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, path);

-- 4. System defaults for project limits
INSERT OR IGNORE INTO system_configs (config_key, config_value, description)
VALUES ('limits.max_projects_per_user', '10', 'Default maximum number of projects allowed per user');

INSERT OR IGNORE INTO system_configs (config_key, config_value, description)
VALUES ('limits.project_storage_cap_bytes', '20971520', 'Default storage size cap per project in bytes (20MB)');

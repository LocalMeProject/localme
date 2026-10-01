-- Migration 003 (Postgres): platform completion pass (issues #1/#7 follow-ups).
-- SQLite twin: db/sqlite/003_platform_completion.sql (see db/README.md parity map).
-- domains already carries project_id (001_init.sql); this pass adds the index.

ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;

ALTER TABLE projects ADD COLUMN watermark_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_domains_project ON domains(project_id);

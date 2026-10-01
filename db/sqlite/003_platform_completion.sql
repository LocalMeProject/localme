-- Migration 003 (SQLite): platform completion pass (issues #1/#7 follow-ups).
--
-- 1. users: failed-login lockout columns (Blueprint §7.2 account lockout).
-- 2. projects: per-project watermark toggle (Blueprint §5.4 watermark switch;
--    docs §14's fixed watermark remains the default via the column default).
--
-- domains already carries project_id (001_init.sql); this pass only adds the
-- routing lookup index.

ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

ALTER TABLE projects ADD COLUMN watermark_enabled INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_domains_project ON domains(project_id);

-- Migration 002 (Postgres): file storage table + rate_limits identity fix.
--
-- Mirrors db/sqlite/002_files_and_rate_limits.sql: adds the ADR 002 file
-- storage table (`files`, bytea blobs) and relaxes rate_limits.session_id to a
-- plain identity column — it also carries IP/API-key identities for
-- unauthenticated callers, so the sessions foreign key was wrong.

CREATE TABLE IF NOT EXISTS files (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_text BOOLEAN NOT NULL DEFAULT TRUE,
    content_text TEXT,
    content_blob BYTEA NOT NULL,
    size_bytes BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, path);

ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS rate_limits_session_id_fkey;

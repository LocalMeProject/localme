-- Migration 002 (SQLite): file storage table + rate_limits identity fix.
--
-- 1. `files` implements ADR 002's DB-backed file storage: project files live
--    in the database, not on disk. The shared asset library is stored with the
--    same shape under a `library/` path prefix managed by the repository layer.
-- 2. rate_limits.session_id was declared REFERENCES sessions(session_id), but
--    the rate-limit identity may also be an IP address or an API-key id
--    (requests without a console session). SQLite cannot drop a constraint in
--    place, so the table is rebuilt without the foreign key.

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_text INTEGER NOT NULL DEFAULT 1,
    content_text TEXT,
    content_blob BLOB NOT NULL,
    size_bytes INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, path);

ALTER TABLE rate_limits RENAME TO rate_limits_old;

-- The old indexes are still attached to rate_limits_old; drop them so the new
-- CREATE INDEX statements below aren't silently skipped by IF NOT EXISTS.
DROP INDEX IF EXISTS idx_rate_limits_session;
DROP INDEX IF EXISTS idx_rate_limits_ip;

CREATE TABLE rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Identity context: the console session id when the caller is signed in,
    -- otherwise an ip:<address> or key:<api-key-id> string. Deliberately NOT a
    -- foreign key — anonymous identities must be rate-limited too.
    session_id TEXT,
    ip TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    route_pattern TEXT,
    window_start TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    UNIQUE(session_id, window_start, route_pattern)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_session ON rate_limits(session_id, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip, window_start);

INSERT INTO rate_limits (id, session_id, ip, user_id, route_pattern, window_start, request_count)
SELECT id, session_id, ip, user_id, route_pattern, window_start, request_count FROM rate_limits_old;

DROP TABLE rate_limits_old;

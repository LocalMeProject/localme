-- LocalMe — initial schema (Postgres)
-- Source of truth: docs/LocalMe — Blueprint.md §4.1 (PostgreSQL Schema) and §4.2
-- (project_data document store). `api_keys` is the hashed-at-rest key table
-- referenced by the Blueprint's API-key authentication (hashed lookup, no plaintext).
-- Applied in lexicographic order by scripts/migrate.mjs with a schema_migrations ledger.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_operator BOOLEAN DEFAULT FALSE,
    storage_cap_bytes BIGINT DEFAULT 5242880, -- 5MB default
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_suspended BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    storage_allocated_bytes BIGINT DEFAULT 0,
    free_visits_per_month INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
    ip TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    route_pattern TEXT,
    window_start TIMESTAMP NOT NULL,
    request_count INTEGER DEFAULT 1,
    UNIQUE(session_id, window_start, route_pattern)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_session ON rate_limits(session_id, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip, window_start);

CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path_pattern TEXT NOT NULL,
    target_file TEXT,
    is_proxy BOOLEAN DEFAULT FALSE,
    proxy_config JSONB,
    requires_auth BOOLEAN DEFAULT FALSE,
    required_role TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, path_pattern)
);

CREATE TABLE IF NOT EXISTS api_endpoints (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    endpoint_name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    requires_auth BOOLEAN DEFAULT TRUE,
    required_role TEXT DEFAULT 'Member',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, endpoint_name)
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    permissions JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, username)
);

CREATE TABLE IF NOT EXISTS secrets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, key_name)
);

CREATE TABLE IF NOT EXISTS cron_configs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    parameters JSONB DEFAULT '{}',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, task_name)
);

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domains (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domain TEXT UNIQUE NOT NULL,
    verification_token TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    ssl_certificate TEXT,
    ssl_private_key TEXT,
    ssl_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
    route TEXT NOT NULL,
    visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,
    ip TEXT,
    user_agent TEXT,
    visited_at TIMESTAMP DEFAULT NOW(),
    is_unique BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS daily_project_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    project_id INTEGER,
    total_visits INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_project_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_project ON daily_project_stats(project_id);

CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    prefix TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);

-- §4.2 JSONB document store. `id` uniqueness is enforced on the JSON text form
-- (document->>'id') per the Blueprint; equality of 1 and "1" therefore follows
-- the spec's text-cast semantics on Postgres.
CREATE TABLE IF NOT EXISTS project_data (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    document JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Expression uniqueness must be a unique index (table constraints cannot carry
-- expressions). Text-cast form per the Blueprint: 1 and "1" are the same id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_data_doc_id
    ON project_data (project_id, table_name, (document->>'id'));

CREATE INDEX IF NOT EXISTS idx_project_data_gin ON project_data USING GIN (document);
CREATE INDEX IF NOT EXISTS idx_project_data_table ON project_data(project_id, table_name);

-- LocalMe Platform Production Schema for Remote PostgreSQL
-- Target Database: sina-infwqq_db
-- All tables exist in public schema for direct persistence

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Platform Users (Developers, Operators, Admins)
CREATE TABLE IF NOT EXISTS platform_users (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(256) NOT NULL,
    phone VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(256) NOT NULL,
    username VARCHAR(128) UNIQUE,
    password_hash VARCHAR(512),
    role VARCHAR(32) NOT NULL DEFAULT 'Developer',
    wallet_balance_irr BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_phone ON platform_users(phone);
CREATE INDEX IF NOT EXISTS idx_platform_users_username ON platform_users(username);

-- 2. BaaS Projects
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    slug VARCHAR(128) UNIQUE NOT NULL,
    description TEXT,
    owner_id VARCHAR(64) NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    owner_phone VARCHAR(32) NOT NULL,
    region VARCHAR(64) NOT NULL DEFAULT 'ir-central-tehran',
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    password_hash VARCHAR(512),
    has_password BOOLEAN NOT NULL DEFAULT FALSE,
    services_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_utc TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- 3. Project Auth Users (End users of tenant apps)
CREATE TABLE IF NOT EXISTS project_auth_users (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phone VARCHAR(32),
    email VARCHAR(256),
    full_name VARCHAR(256),
    provider VARCHAR(64) NOT NULL DEFAULT 'sms_otp',
    is_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sign_in_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_auth_users_prj ON project_auth_users(project_id);

-- 4. Project IPG Configurations
CREATE TABLE IF NOT EXISTS project_ipg_configs (
    project_id VARCHAR(64) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    terminal_id VARCHAR(128),
    merchant_key VARCHAR(256),
    default_psp VARCHAR(64) NOT NULL DEFAULT 'ZARINPAL',
    enforce_card_mask BOOLEAN NOT NULL DEFAULT TRUE,
    is_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Project Collaborators (Team)
CREATE TABLE IF NOT EXISTS project_collaborators (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    full_name VARCHAR(256) NOT NULL,
    email_or_phone VARCHAR(256) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'Developer',
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    added_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_prj ON project_collaborators(project_id);

-- 6. Project Compliance Configs
CREATE TABLE IF NOT EXISTS project_compliance_configs (
    project_id VARCHAR(64) PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    enamad_token VARCHAR(256),
    enamad_symbol_code VARCHAR(256),
    samandehi_code VARCHAR(256),
    android_package_name VARCHAR(256),
    android_sha256 VARCHAR(256),
    apple_team_id VARCHAR(128),
    apple_app_bundle_id VARCHAR(256),
    updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Project Deployments
CREATE TABLE IF NOT EXISTS project_deployments (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch VARCHAR(128) NOT NULL DEFAULT 'main',
    commit_sha VARCHAR(64),
    domain VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'Live',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    preview_url TEXT,
    deployed_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_deployments_prj ON project_deployments(project_id);

-- 8. Project Custom Domains
CREATE TABLE IF NOT EXISTS project_domains (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domain VARCHAR(256) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    ssl_status VARCHAR(64) NOT NULL DEFAULT 'Active',
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_domains_prj ON project_domains(project_id);

-- 9. Project Storage Buckets
CREATE TABLE IF NOT EXISTS project_buckets (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_buckets_prj ON project_buckets(project_id);

-- 10. Project Storage Files
CREATE TABLE IF NOT EXISTS project_storage_files (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bucket VARCHAR(128) NOT NULL,
    file_name VARCHAR(512) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    download_url TEXT,
    uploaded_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_storage_files_prj ON project_storage_files(project_id, bucket);

-- 11. Project Edge Functions
CREATE TABLE IF NOT EXISTS project_functions (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    trigger_path VARCHAR(256) NOT NULL,
    script TEXT NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_project_functions_prj ON project_functions(project_id);

-- 12. Project Logs
CREATE TABLE IF NOT EXISTS project_logs (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service VARCHAR(64) NOT NULL,
    level VARCHAR(32) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    trace_id VARCHAR(128),
    status_code INT,
    latency_ms BIGINT,
    timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_logs_prj ON project_logs(project_id, timestamp_utc DESC);

-- 13. Shetab Payments
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    authority_token VARCHAR(128) UNIQUE NOT NULL,
    psp VARCHAR(64) NOT NULL,
    amount_irr BIGINT NOT NULL,
    customer_phone VARCHAR(32),
    callback_url TEXT NOT NULL,
    description TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'INITIATED',
    trace_no VARCHAR(128),
    card_mask VARCHAR(64),
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at_utc TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_authority ON payments(authority_token);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);

-- 14. Project Dynamic Table Records (Data Studio PostgREST storage)
CREATE TABLE IF NOT EXISTS project_table_records (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    table_name VARCHAR(128) NOT NULL,
    record_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_utc TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_table_records ON project_table_records(project_id, table_name);

-- LocalMe Control Plane Schema (Section 6.1 SSOT)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE SCHEMA IF NOT EXISTS control_plane;
SET search_path = control_plane, public;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('PROVISIONING', 'ACTIVE', 'THROTTLED', 'SUSPENDED', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE capability_code AS ENUM (
        'BASE', 'BAAS_DB', 'IDAAS', 'RTAAS', 'RTDAAS', 'COMPUTE_EDGE',
        'FIN_IPG', 'FIN_IAP', 'STORAGE_BLOB', 'EDA_STREAM', 'WORKFLOW_DUR',
        'COMPUTE_HEAVY', 'CACHE_LOCK', 'OLAP_ENGINE', 'PUSH_ENGINE',
        'MOBILE_OPS', 'HOSTING_WEB'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE primitive_code AS ENUM (
        'DNS_SUBDOMAIN', 'YARP_ROUTE', 'COMPLIANCE_RESPONDER', 'TELEMETRY_METER',
        'PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'REDIS_KV',
        'JINT_ISOLATE', 'CLEARSCRIPT_V8_ISOLATE', 'PG_LISTEN_NOTIFY', 'REDIS_STREAMS',
        'SIGNALR_GATEWAY', 'SECRET_VAULT', 'STATIC_EGRESS_NAT', 'BLOB_STORAGE_ADAPTER',
        'TUSDOTNET_PROXY', 'IMAGESHARP_PROXY', 'HEAVY_WORKER_POOL', 'PG_ANALYTICS_PART',
        'MQTTNET_BROKER', 'FCM_APNS_ADAPTER', 'EDGE_CACHE', 'LETTUCEENCRYPT_SSL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE primitive_state AS ENUM ('PENDING', 'PROVISIONING', 'HEALTHY', 'DEGRADED', 'SUSPENDED', 'DEPROVISIONING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE storage_adapter_kind AS ENUM (
        'RUNFLARE_BLOB', 'ARVAN_S3', 'PARSPACK_S3', 'MINIO_S3',
        'AWS_S3', 'CLOUDFLARE_R2', 'LOCAL_DISK'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE js_engine_kind AS ENUM ('JINT', 'CLEARSCRIPT_V8');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    wallet_balance_irr BIGINT NOT NULL DEFAULT 0 CHECK (wallet_balance_irr >= 0),
    billing_email VARCHAR(255) NOT NULL,
    billing_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(63) UNIQUE NOT NULL,
    custom_domain VARCHAR(255) UNIQUE,
    custom_domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status project_status NOT NULL DEFAULT 'PROVISIONING',
    jwt_ed25519_public_key TEXT NOT NULL,
    jwt_ed25519_private_key_enc BYTEA NOT NULL,
    active_web_deployment_id UUID,
    monthly_spend_cap_irr BIGINT CHECK (monthly_spend_cap_irr IS NULL OR monthly_spend_cap_irr >= 0),
    js_engine js_engine_kind NOT NULL DEFAULT 'JINT',
    storage_adapter_key storage_adapter_kind NOT NULL DEFAULT 'RUNFLARE_BLOB',
    storage_adapter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    compliance_config JSONB NOT NULL DEFAULT '{
        "enamad_meta_token": null,
        "enamad_file_content": null,
        "samandehi_file_content": null,
        "inject_meta_in_spa": true,
        "stub_storefront_enabled": true,
        "business_title_fa": "",
        "support_phone": "",
        "legal_address_fa": "",
        "android_package_name": null,
        "android_sha256_fingerprints": [],
        "ios_app_id": null
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);
CREATE INDEX IF NOT EXISTS idx_projects_custom_domain ON projects (custom_domain) WHERE custom_domain IS NOT NULL;

CREATE TABLE IF NOT EXISTS project_secrets (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    secret_key VARCHAR(128) NOT NULL,
    cipher_value BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, secret_key)
);

CREATE TABLE IF NOT EXISTS project_capabilities (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    capability capability_code NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, capability)
);

CREATE TABLE IF NOT EXISTS project_primitives (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    primitive primitive_code NOT NULL,
    ref_count INT NOT NULL DEFAULT 1 CHECK (ref_count >= 0),
    state primitive_state NOT NULL DEFAULT 'PENDING',
    endpoint_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, primitive)
);

CREATE TABLE IF NOT EXISTS web_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha VARCHAR(64),
    file_count INT NOT NULL,
    total_size_bytes BIGINT NOT NULL,
    storage_prefix TEXT NOT NULL,
    spa_fallback BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

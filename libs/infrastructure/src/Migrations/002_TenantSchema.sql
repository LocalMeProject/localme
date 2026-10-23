-- LocalMe Tenant Data Plane PostgreSQL Schema (Section 6.2 SSOT)
-- Provisioned per Project Tenant Schema

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS workflows;
CREATE SCHEMA IF NOT EXISTS push;
CREATE SCHEMA IF NOT EXISTS storage;

-- 1. IDENTITY & AUTH SCHEMA
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash TEXT,               -- Argon2id
    national_code VARCHAR(10),
    is_kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(32) NOT NULL DEFAULT 'authenticated',
    raw_user_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_app_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sign_in_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    family_id UUID NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper functions for PostgreSQL RLS Policies
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE SQL STABLE;

-- 2. FINANCIAL IRR LEDGER, IPG & IAP SCHEMA
DO $$ BEGIN
    CREATE TYPE finance.ipg_provider AS ENUM ('ZARINPAL', 'BEHPARDAKHT', 'SEP', 'PARSIAN', 'IDPAY', 'ZIBAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE finance.tx_status AS ENUM ('INITIATED', 'VERIFIED', 'FAILED', 'REVERSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE finance.iap_store AS ENUM ('CAFEBAZAAR', 'MYKET', 'APPLE_STOREKIT', 'GOOGLE_PLAY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS finance.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    balance_irr BIGINT NOT NULL DEFAULT 0 CHECK (balance_irr >= 0),
    locked_irr BIGINT NOT NULL DEFAULT 0 CHECK (locked_irr >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES finance.wallets(id) ON DELETE RESTRICT,
    amount_irr BIGINT NOT NULL CHECK (amount_irr <> 0),
    balance_after_irr BIGINT NOT NULL CHECK (balance_after_irr >= 0),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.ipg_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    provider finance.ipg_provider NOT NULL,
    amount_irr BIGINT NOT NULL CHECK (amount_irr >= 10000),
    authority_token VARCHAR(255) UNIQUE,
    ref_id VARCHAR(255),
    card_pan_masked VARCHAR(32),
    card_hash VARCHAR(128),
    status finance.tx_status NOT NULL DEFAULT 'INITIATED',
    callback_deep_link TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS finance.iap_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    store finance.iap_store NOT NULL,
    product_id VARCHAR(128) NOT NULL,
    purchase_token VARCHAR(512) NOT NULL,
    is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    raw_provider_response JSONB NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store, purchase_token)
);

-- 3. DURABLE WORKFLOW JOURNAL SCHEMA
DO $$ BEGIN
    CREATE TYPE workflows.exec_status AS ENUM ('RUNNING', 'SLEEPING', 'WAITING_EVENT', 'COMPLETED', 'FAILED', 'COMPENSATING', 'COMPENSATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS workflows.executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    status workflows.exec_status NOT NULL DEFAULT 'RUNNING',
    input_payload JSONB NOT NULL,
    output_payload JSONB,
    error_detail TEXT,
    attempt INT NOT NULL DEFAULT 1,
    wake_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows.step_journal (
    execution_id UUID NOT NULL REFERENCES workflows.executions(id) ON DELETE CASCADE,
    step_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,          -- 'COMPLETED', 'COMPENSATED'
    output_payload JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (execution_id, step_key)
);

-- 4. PUSH NOTIFICATION DEVICE REGISTRY
CREATE TABLE IF NOT EXISTS push.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(128) NOT NULL,
    platform VARCHAR(16) NOT NULL CHECK (platform IN ('ANDROID', 'IOS', 'WEB')),
    fcm_token TEXT,
    apns_token TEXT,
    domestic_mqtt_client_id VARCHAR(128) UNIQUE NOT NULL,
    app_version VARCHAR(32),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_fingerprint)
);

-- 5. STORAGE OBJECTS METADATA
CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket VARCHAR(128) NOT NULL,
    object_key TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    content_type VARCHAR(255),
    etag VARCHAR(128),
    adapter_key VARCHAR(32) NOT NULL,     -- which IBlobStorageAdapter wrote it
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bucket, object_key)
);

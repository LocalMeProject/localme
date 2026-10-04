-- Migration 011 (PostgreSQL): Subscriptions, granular storage caps, and payment transactions.

-- 1. Subscription fields on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS library_storage_cap_bytes BIGINT NOT NULL DEFAULT 3145728; -- 3 MB

UPDATE users SET max_projects = 3, project_storage_cap_bytes = 3145728, library_storage_cap_bytes = 3145728
WHERE subscription_tier = 'free' AND is_admin = false AND is_operator = false;

-- 2. Payment transactions table for ZarinPal
CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'plus',
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IRT',
    authority TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    ref_id TEXT,
    card_pan TEXT,
    card_hash TEXT,
    fee BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_authority ON payment_transactions(authority);

-- 3. System configs for subscriptions & limits
INSERT INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_price_toman', '199000', 'Price of Plus plan in Tomans per month')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_max_projects', '50', 'Maximum projects for Plus tier')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_project_cap_bytes', '52428800', 'Per-project storage cap for Plus tier in bytes (50 MB)')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_library_cap_bytes', '52428800', 'Library storage cap for Plus tier in bytes (50 MB)')
ON CONFLICT (config_key) DO NOTHING;

UPDATE system_configs SET config_value = '3' WHERE config_key = 'limits.max_projects_per_user';
UPDATE system_configs SET config_value = '3145728' WHERE config_key = 'limits.project_storage_cap_bytes';

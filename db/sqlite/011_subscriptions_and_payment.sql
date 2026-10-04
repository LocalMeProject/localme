-- Migration 011 (SQLite): Subscriptions, granular storage caps, and payment transactions.

-- 1. Subscription fields on users
ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_expires_at TEXT;
ALTER TABLE users ADD COLUMN library_storage_cap_bytes INTEGER NOT NULL DEFAULT 3145728; -- 3 MB

-- Update existing free users to standard 3 project / 3 MB cap defaults
UPDATE users SET max_projects = 3, project_storage_cap_bytes = 3145728, library_storage_cap_bytes = 3145728
WHERE subscription_tier = 'free' AND is_admin = 0 AND is_operator = 0;

-- 2. Payment transactions table for ZarinPal
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'plus',
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IRT',
    authority TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    ref_id TEXT,
    card_pan TEXT,
    card_hash TEXT,
    fee INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_authority ON payment_transactions(authority);

-- 3. System configs for subscriptions & limits
INSERT OR IGNORE INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_price_toman', '199000', 'Price of Plus plan in Tomans per month');

INSERT OR IGNORE INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_max_projects', '50', 'Maximum projects for Plus tier');

INSERT OR IGNORE INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_project_cap_bytes', '52428800', 'Per-project storage cap for Plus tier in bytes (50 MB)');

INSERT OR IGNORE INTO system_configs (config_key, config_value, description)
VALUES ('subscription.plus_library_cap_bytes', '52428800', 'Library storage cap for Plus tier in bytes (50 MB)');

UPDATE system_configs SET config_value = '3' WHERE config_key = 'limits.max_projects_per_user';
UPDATE system_configs SET config_value = '3145728' WHERE config_key = 'limits.project_storage_cap_bytes';

-- 012_agent_and_pat_tokens.sql (Postgres)

-- 1. Add allow_agent_requests toggle to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_agent_requests BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Enhanced unified tokens table (PAT and AAT)
CREATE TABLE IF NOT EXISTS api_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type VARCHAR(16) NOT NULL CHECK (token_type IN ('pat', 'aat')),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  token_encrypted TEXT,
  prefix VARCHAR(32) NOT NULL,
  permissions TEXT NOT NULL DEFAULT '["*"]',
  rotation_interval VARCHAR(16) CHECK (rotation_interval IN ('4h', '6h', '12h', '1d', '7d', '15d', '1m', '3m', '6m', '1y')),
  next_rotation_at TIMESTAMPTZ,
  rotation_grace_until TIMESTAMPTZ,
  previous_token_hash VARCHAR(128),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id, token_type);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_prev_hash ON api_tokens(previous_token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expiry ON api_tokens(expires_at);

-- 3. Consent requests table for agent AAT authorization
CREATE TABLE IF NOT EXISTS token_consent_requests (
  id VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name VARCHAR(128) NOT NULL,
  token_name VARCHAR(128) NOT NULL,
  description TEXT,
  requested_duration VARCHAR(16) NOT NULL CHECK (requested_duration IN ('4h', '1d')),
  approved_duration VARCHAR(16) CHECK (approved_duration IN ('4h', '1d')),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  issued_token_id BIGINT REFERENCES api_tokens(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_consent_user ON token_consent_requests(user_id, status);

-- 4. Audit logging for all key lifecycle events
CREATE TABLE IF NOT EXISTS token_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event VARCHAR(64) NOT NULL,
  token_id BIGINT,
  token_type VARCHAR(16) NOT NULL,
  token_prefix VARCHAR(32),
  actor VARCHAR(16) NOT NULL CHECK (actor IN ('user', 'agent', 'system')),
  ip_address VARCHAR(64),
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_audit_user ON token_audit_logs(user_id, created_at);

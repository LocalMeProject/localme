-- 012_agent_and_pat_tokens.sql (SQLite)

-- 1. Add allow_agent_requests toggle to users
ALTER TABLE users ADD COLUMN allow_agent_requests INTEGER NOT NULL DEFAULT 0;

-- 2. Enhanced unified tokens table (PAT and AAT)
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('pat', 'aat')),
  name TEXT NOT NULL,
  description TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  token_encrypted TEXT,
  prefix TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '["*"]',
  rotation_interval TEXT CHECK (rotation_interval IN ('4h', '6h', '12h', '1d', '7d', '15d', '1m', '3m', '6m', '1y')),
  next_rotation_at TEXT,
  rotation_grace_until TEXT,
  previous_token_hash TEXT,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id, token_type);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_prev_hash ON api_tokens(previous_token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expiry ON api_tokens(expires_at);

-- 3. Consent requests table for agent AAT authorization
CREATE TABLE IF NOT EXISTS token_consent_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  token_name TEXT NOT NULL,
  description TEXT,
  requested_duration TEXT NOT NULL CHECK (requested_duration IN ('4h', '1d')),
  approved_duration TEXT CHECK (approved_duration IN ('4h', '1d')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  issued_token_id INTEGER REFERENCES api_tokens(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_token_consent_user ON token_consent_requests(user_id, status);

-- 4. Audit logging for all key lifecycle events
CREATE TABLE IF NOT EXISTS token_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  token_id INTEGER,
  token_type TEXT NOT NULL,
  token_prefix TEXT,
  actor TEXT NOT NULL CHECK (actor IN ('user', 'agent', 'system')),
  ip_address TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_token_audit_user ON token_audit_logs(user_id, created_at);

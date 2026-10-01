-- Migration 006 (SQLite): ACME HTTP-01 challenge store.
--
-- §5.6 step 5 provisions a certificate after the DNS TXT check. The ACME CA
-- then fetches http://<domain>/.well-known/acme-challenge/<token> and expects
-- the exact `keyAuthorization` body, so the order writes it here and the
-- challenge route serves it on any host — including a domain that is not
-- verified yet, which is why the middleware lets that path through first.
--
-- Postgres twin: db/postgres/006_acme_challenges.sql

CREATE TABLE IF NOT EXISTS acme_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    token TEXT NOT NULL,
    key_authorization TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (domain, token)
);

CREATE INDEX IF NOT EXISTS idx_acme_challenges_token ON acme_challenges (token);
CREATE INDEX IF NOT EXISTS idx_acme_challenges_expiry ON acme_challenges (expires_at);

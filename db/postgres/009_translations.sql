-- Migration 009 (Postgres): operator-editable UI translations.
-- SQLite twin: db/sqlite/009_translations.sql
--
-- See the SQLite twin for the rationale. One row per (locale, message_key)
-- override; anything not present falls back to the catalog shipped in the
-- bundle, so a platform upgrade that improves a default string is picked up
-- without touching operator customisations.

CREATE TABLE IF NOT EXISTS translations (
    locale TEXT NOT NULL,
    message_key TEXT NOT NULL,
    message_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (locale, message_key)
);

CREATE INDEX IF NOT EXISTS ix_translations_locale ON translations (locale);
-- Migration 009 (SQLite): operator-editable UI translations.
-- Postgres twin: db/postgres/009_translations.sql
--
-- Every user-visible string ships in the bundle as `lib/i18n/messages/*`, which
-- is the floor and the fallback. This table holds *overrides*: the wording an
-- operator writes in the admin console.
--
-- It is deliberately a table rather than another `system_configs` blob. The
-- admin editor works one message at a time, across two locales, with search
-- and a per-key "modified" badge and a single-key reset. A JSON value in one
-- key/value row would mean rewriting the entire catalogue on every keystroke
-- saved, and would put a deployment's whole Persian copy inside one database
-- cell where a partial write is unrecoverable.
--
-- Only keys that differ from the shipped text are stored, so a platform
-- upgrade that improves a default string is picked up automatically, and
-- `message_value = ''` is never written: the console sends NULL for "revert",
-- and deleting the row is the only way to revert (see lib/server/i18n.ts).

CREATE TABLE IF NOT EXISTS translations (
    locale TEXT NOT NULL,
    message_key TEXT NOT NULL,
    message_value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (locale, message_key)
);

CREATE INDEX IF NOT EXISTS ix_translations_locale ON translations (locale);
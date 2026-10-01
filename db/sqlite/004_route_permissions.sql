-- Migration 004 (SQLite): per-route granular permission requirement.
--
-- §5.5 stores permissions on roles and §6.2 puts them in the visitor JWT, but a
-- route could only name a role. `required_permission` lets a route demand one
-- specific permission (e.g. `analytics_read` for a reports page) on top of —
-- or instead of — `required_role`.
--
-- Postgres twin: db/postgres/004_route_permissions.sql

ALTER TABLE routes ADD COLUMN required_permission TEXT;

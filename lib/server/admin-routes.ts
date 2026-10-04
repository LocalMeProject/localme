/**
 * Operator/admin console APIs (Blueprint §9): user and project administration,
 * impersonation, platform stats, public library and system configuration.
 *
 * This barrel file re-exports all endpoints from domain-specific modules in
 * `@/lib/server/admin/*` for backwards compatibility.
 */

export * from "./admin/common";
export * from "./admin/overview";
export * from "./admin/users";
export * from "./admin/projects";
export * from "./admin/impersonate";
export * from "./admin/cron";
export * from "./admin/config";
export * from "./admin/public-library";
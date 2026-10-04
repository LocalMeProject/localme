/**
 * Console management endpoints for project configuration entities:
 * routes, API keys, visitors, roles, domains, endpoints, and tables.
 *
 * Blueprint §6.3 project configuration APIs.
 * Modularized into domain modules under lib/server/console/
 */
export * from "./console/common";
export * from "./console/routes";
export * from "./console/keys";
export * from "./console/visitors";
export * from "./console/roles";
export * from "./console/domain-ssl";
export * from "./console/tables";

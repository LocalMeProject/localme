/** Granular permissions attached to project roles (Blueprint §5.5). */
export const ALL_PERMISSIONS = [
  "db_read",
  "db_write",
  "db_admin",
  "storage_read",
  "storage_write",
  "storage_admin",
  "lib_read",
  "lib_write",
  "visitors_admin",
  "secrets_admin",
  "routes_admin",
  "webhooks_admin",
  "cron_admin",
  "project_admin",
  "domains_admin",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  db_read: "Read documents",
  db_write: "Insert / update / delete documents",
  db_admin: "Manage tables",
  storage_read: "Download files",
  storage_write: "Upload / delete files",
  storage_admin: "Manage any file in the project",
  lib_read: "Read library assets",
  lib_write: "Upload to the library",
  visitors_admin: "Manage visitor accounts and roles",
  secrets_admin: "Manage secrets",
  routes_admin: "Manage routing and proxy rules",
  webhooks_admin: "Manage webhooks",
  cron_admin: "Configure scheduled tasks",
  project_admin: "Change project settings",
  domains_admin: "Manage custom domains",
};

function mapPermissions(names: readonly Permission[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const name of ALL_PERMISSIONS) out[name] = names.includes(name);
  return out;
}

/** Pre-defined roles created with every project. */
export const DEFAULT_ROLES: { name: string; permissions: Record<string, boolean>; isSystem: boolean }[] = [
  { name: "Owner", permissions: mapPermissions(ALL_PERMISSIONS), isSystem: true },
  {
    name: "Admin",
    permissions: mapPermissions(ALL_PERMISSIONS.filter((name) => name !== "project_admin")),
    isSystem: true,
  },
  {
    name: "Member",
    permissions: mapPermissions(["db_read", "db_write", "storage_read", "lib_read"]),
    isSystem: true,
  },
  {
    name: "Guest",
    permissions: mapPermissions(["db_read", "storage_read", "lib_read"]),
    isSystem: true,
  },
];

/**
 * Rank of the built-in roles. Route and endpoint gates use this so a higher
 * built-in role satisfies a lower requirement (Owner > Admin > Member > Guest).
 * Custom roles must be named exactly, because their permission sets are
 * arbitrary and carry no implied rank.
 */
export const ROLE_RANK: Record<string, number> = { Owner: 4, Admin: 3, Member: 2, Guest: 1 };

export function roleSatisfies(roleName: string | undefined, required: string | undefined): boolean {
  if (!required) return true;
  if (!roleName) return false;
  if (roleName === required) return true;
  const have = ROLE_RANK[roleName];
  const need = ROLE_RANK[required];
  if (have === undefined || need === undefined) return false;
  return have >= need;
}

export function permissionsForRole(roleName: string | undefined): Record<string, boolean> {
  const role = DEFAULT_ROLES.find((candidate) => candidate.name === roleName);
  if (role) return role.permissions;
  return DEFAULT_ROLES[DEFAULT_ROLES.length - 1].permissions;
}

/** Pre-defined API endpoints that a project may enable or disable. */
export const API_ENDPOINTS: { name: string; description: string }[] = [
  { name: "db_find", description: "POST /api/db/find — query documents" },
  { name: "db_insert", description: "POST /api/db/insert — insert a document" },
  { name: "db_update", description: "POST /api/db/update — update documents" },
  { name: "db_delete", description: "POST /api/db/delete — delete documents" },
  { name: "storage_list", description: "GET /api/storage/list — list project files" },
  { name: "storage_upload", description: "POST /api/storage/upload — upload a file" },
  { name: "storage_download", description: "GET /api/storage/download — download a file" },
  { name: "storage_delete", description: "POST /api/storage/delete — delete a file" },
  { name: "storage_status", description: "GET /api/storage/status — storage usage" },
  { name: "lib_list", description: "GET /api/lib/list — list library assets" },
  { name: "lib_upload", description: "POST /api/lib/upload — upload a library asset" },
  { name: "lib_delete", description: "POST /api/lib/delete — delete a library asset" },
  { name: "lib_status", description: "GET /api/lib/status — library usage" },
  { name: "secrets_get", description: "POST /api/secrets/get — read a secret value" },
];

export const ENDPOINT_PERMISSION: Record<string, Permission> = {
  db_find: "db_read",
  db_insert: "db_write",
  db_update: "db_write",
  db_delete: "db_write",
  storage_list: "storage_read",
  storage_upload: "storage_write",
  storage_download: "storage_read",
  storage_delete: "storage_write",
  storage_status: "storage_read",
  lib_list: "lib_read",
  lib_upload: "lib_write",
  lib_delete: "lib_write",
  lib_status: "lib_read",
  secrets_get: "secrets_admin",
};

/** Cron tasks available to every project (Blueprint §5.8). */
export const CRON_TASKS = [
  {
    name: "CleanExpiredSessions",
    description: "Deletes expired session records.",
    schedule: "Daily at 02:00 UTC",
    defaultParameters: { retention_days: 7 },
  },
  {
    name: "CleanOldLogs",
    description: "Deletes visit logs older than the retention window.",
    schedule: "Daily at 03:00 UTC",
    defaultParameters: {},
  },
  {
    name: "GenerateDailyStats",
    description: "Aggregates the previous day's visit logs into daily stats.",
    schedule: "Daily at 01:00 UTC",
    defaultParameters: {},
  },
  {
    name: "SendDailySummaryWebhook",
    description: "Posts a daily summary payload to a selected webhook.",
    schedule: "Daily at 08:00 UTC",
    defaultParameters: { webhook_id: "" },
  },
  {
    name: "CleanOrphanedUploads",
    description: "Removes temporary upload artefacts older than 24 hours.",
    schedule: "Weekly on Sunday at 04:00 UTC",
    defaultParameters: {},
  },
] as const;

export const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "user.login",
  "user.signup",
  "storage.cap_exceeded",
  "cron.started",
  "cron.completed",
  "cron.failed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

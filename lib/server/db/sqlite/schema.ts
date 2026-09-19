/**
 * LocalMe SQLite schema (Drizzle) — twin of lib/server/db/postgres/schema.ts
 * (Blueprint §4.1/§4.2; see db/README.md for the type parity map).
 *
 * SQLite conventions: JSON columns are TEXT (application-serialized), timestamps
 * are TEXT ISO-8601 (lexicographically ordered), booleans are integerMode 0/1.
 * Only platform-owned tables live here — the per-project document store
 * (project_data) is read through the DSL compiler, not this schema.
 */
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  email: text("email"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  isOperator: integer("is_operator", { mode: "boolean" }).notNull().default(false),
  storageCapBytes: integer("storage_cap_bytes").notNull().default(5242880),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLogin: text("last_login"),
  isSuspended: integer("is_suspended", { mode: "boolean" }).notNull().default(false),
});

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    storageAllocatedBytes: integer("storage_allocated_bytes").notNull().default(0),
    freeVisitsPerMonth: integer("free_visits_per_month").notNull().default(100),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("projects_user_name_uq").on(t.userId, t.name)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    sessionId: text("session_id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** JSON-serialized session payload (see db/README.md parity map). */
    data: text("data").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastAccessedAt: text("last_accessed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_sessions_expires").on(t.expiresAt), index("idx_sessions_user_id").on(t.userId)],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").references(() => sessions.sessionId, { onDelete: "cascade" }),
    ip: text("ip"),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    routePattern: text("route_pattern"),
    windowStart: text("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (t) => [
    index("idx_rate_limits_session").on(t.sessionId, t.windowStart),
    index("idx_rate_limits_ip").on(t.ip, t.windowStart),
  ],
);

export const routes = sqliteTable(
  "routes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pathPattern: text("path_pattern").notNull(),
    targetFile: text("target_file"),
    isProxy: integer("is_proxy", { mode: "boolean" }).notNull().default(false),
    proxyConfig: text("proxy_config"),
    requiresAuth: integer("requires_auth", { mode: "boolean" }).notNull().default(false),
    requiredRole: text("required_role"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("routes_project_path_uq").on(t.projectId, t.pathPattern)],
);

export const apiEndpoints = sqliteTable(
  "api_endpoints",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    endpointName: text("endpoint_name").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    requiresAuth: integer("requires_auth", { mode: "boolean" }).notNull().default(true),
    requiredRole: text("required_role").notNull().default("Member"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("api_endpoints_project_name_uq").on(t.projectId, t.endpointName)],
);

export const roles = sqliteTable(
  "roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** JSON-serialized permissions map. */
    permissions: text("permissions").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("roles_project_name_uq").on(t.projectId, t.name)],
);

export const visitors = sqliteTable(
  "visitors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id").references(() => roles.id, { onDelete: "set null" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("visitors_project_username_uq").on(t.projectId, t.username)],
);

export const secrets = sqliteTable(
  "secrets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("secrets_project_key_uq").on(t.projectId, t.keyName)],
);

export const cronConfigs = sqliteTable(
  "cron_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskName: text("task_name").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    /** JSON-serialized parameters object. */
    parameters: text("parameters").notNull().default("{}"),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("cron_configs_project_task_uq").on(t.projectId, t.taskName)],
);

export const webhooks = sqliteTable("webhooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret"),
  /** JSON-serialized string[]. */
  events: text("events").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  webhookId: integer("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  /** JSON-serialized payload. */
  payload: text("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  deliveredAt: text("delivered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const domains = sqliteTable(
  "domains",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    verificationToken: text("verification_token").notNull(),
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    sslCertificate: text("ssl_certificate"),
    sslPrivateKey: text("ssl_private_key"),
    sslExpiresAt: text("ssl_expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("domains_domain_uq").on(t.domain)],
);

export const visitLogs = sqliteTable("visit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => sessions.sessionId, { onDelete: "set null" }),
  route: text("route").notNull(),
  visitorId: integer("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  visitedAt: text("visited_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  isUnique: integer("is_unique", { mode: "boolean" }).notNull().default(true),
});

export const dailyProjectStats = sqliteTable(
  "daily_project_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    projectId: integer("project_id"),
    totalVisits: integer("total_visits").notNull().default(0),
    uniqueVisitors: integer("unique_visitors").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_daily_stats_date").on(t.date), index("idx_daily_stats_project").on(t.projectId)],
);

export const systemConfigs = sqliteTable(
  "system_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    configKey: text("config_key").notNull(),
    /** JSON-serialized config value. */
    configValue: text("config_value").notNull(),
    description: text("description"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("system_configs_key_uq").on(t.configKey)],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    /** JSON-serialized permissions map. */
    permissions: text("permissions").notNull().default("{}"),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash), index("idx_api_keys_project").on(t.projectId)],
);

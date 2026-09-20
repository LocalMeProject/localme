/**
 * LocalMe Postgres schema (Drizzle).
 *
 * Source of truth: docs/LocalMe — Blueprint.md §4.1/§4.2. Kept in lockstep with
 * db/postgres/001_init.sql and the SQLite twin (lib/server/db/sqlite/schema.ts).
 * Only platform-owned tables live here — the per-project document store
 * (project_data) is read through the DSL compiler, not this schema.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

/** Drizzle `text().array()` reads back unknown; this keeps the TS type string[]. */
const textArray = customType<{ data: string[]; driverData: string[] }>({
  dataType() {
    return "text[]";
  },
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: varchar("email", { length: 255 }),
  isAdmin: boolean("is_admin").notNull().default(false),
  isOperator: boolean("is_operator").notNull().default(false),
  storageCapBytes: bigint("storage_cap_bytes", { mode: "number" }).notNull().default(5242880),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
  isSuspended: boolean("is_suspended").notNull().default(false),
});

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 32 }).notNull(),
    storageAllocatedBytes: bigint("storage_allocated_bytes", { mode: "number" }).notNull().default(0),
    freeVisitsPerMonth: integer("free_visits_per_month").notNull().default(100),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("projects_user_name_uq").on(t.userId, t.name)],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionId: text("session_id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_expires").on(t.expiresAt), index("idx_sessions_user_id").on(t.userId)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").references(() => sessions.sessionId, { onDelete: "cascade" }),
    ip: text("ip"),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    routePattern: text("route_pattern"),
    windowStart: timestamp("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (t) => [
    index("idx_rate_limits_session").on(t.sessionId, t.windowStart),
    index("idx_rate_limits_ip").on(t.ip, t.windowStart),
  ],
);

export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pathPattern: text("path_pattern").notNull(),
    targetFile: text("target_file"),
    isProxy: boolean("is_proxy").notNull().default(false),
    proxyConfig: jsonb("proxy_config"),
    requiresAuth: boolean("requires_auth").notNull().default(false),
    requiredRole: text("required_role"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("routes_project_path_uq").on(t.projectId, t.pathPattern)],
);

export const apiEndpoints = pgTable(
  "api_endpoints",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    endpointName: text("endpoint_name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    requiresAuth: boolean("requires_auth").notNull().default(true),
    requiredRole: text("required_role").notNull().default("Member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_endpoints_project_name_uq").on(t.projectId, t.endpointName)],
);

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    permissions: jsonb("permissions").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("roles_project_name_uq").on(t.projectId, t.name)],
);

export const visitors = pgTable(
  "visitors",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id").references(() => roles.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("visitors_project_username_uq").on(t.projectId, t.username)],
);

export const secrets = pgTable(
  "secrets",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("secrets_project_key_uq").on(t.projectId, t.keyName)],
);

export const cronConfigs = pgTable(
  "cron_configs",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskName: text("task_name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    parameters: jsonb("parameters").notNull().default(sql`'{}'::jsonb`),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cron_configs_project_task_uq").on(t.projectId, t.taskName)],
);

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret"),
  events: textArray("events").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  deliveredAt: timestamp("delivered_at").notNull().defaultNow(),
});

export const domains = pgTable(
  "domains",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    verificationToken: text("verification_token").notNull(),
    isVerified: boolean("is_verified").notNull().default(false),
    sslCertificate: text("ssl_certificate"),
    sslPrivateKey: text("ssl_private_key"),
    sslExpiresAt: timestamp("ssl_expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("domains_domain_uq").on(t.domain)],
);

export const visitLogs = pgTable("visit_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => sessions.sessionId, { onDelete: "set null" }),
  route: text("route").notNull(),
  visitorId: integer("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  visitedAt: timestamp("visited_at").notNull().defaultNow(),
  isUnique: boolean("is_unique").notNull().default(true),
});

export const dailyProjectStats = pgTable(
  "daily_project_stats",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    projectId: integer("project_id"),
    totalVisits: integer("total_visits").notNull().default(0),
    uniqueVisitors: integer("unique_visitors").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_daily_stats_date").on(t.date), index("idx_daily_stats_project").on(t.projectId)],
);

export const systemConfigs = pgTable(
  "system_configs",
  {
    id: serial("id").primaryKey(),
    configKey: text("config_key").notNull(),
    configValue: jsonb("config_value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("system_configs_key_uq").on(t.configKey)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    permissions: jsonb("permissions").notNull().default(sql`'{}'::jsonb`),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash), index("idx_api_keys_project").on(t.projectId)],
);

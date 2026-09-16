import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * LocalMe platform schema.
 *
 * The published specification describes a PostgreSQL schema; this deployment
 * target (Convex) is the platform's single source of truth equivalent: every
 * persistent entity from the specification has a table here, with the same
 * fields, plus indexes that replace the documented SQL indexes.
 */
export default defineSchema({
  /** Platform accounts (documented `users` table). */
  users: defineTable({
    username: v.string(),
    email: v.optional(v.string()),
    passwordHash: v.string(),
    /** Admin = full system control, Operator = read-only support, User = standard. */
    role: v.union(v.literal("admin"), v.literal("operator"), v.literal("user")),
    storageCapBytes: v.number(),
    isSuspended: v.boolean(),
    failedLoginAttempts: v.number(),
    lockoutUntil: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_email", ["email"]),

  /** Database-backed sessions (documented `sessions` table). */
  sessions: defineTable({
    token: v.string(),
    kind: v.union(v.literal("platform"), v.literal("visitor")),
    userId: v.optional(v.id("users")),
    projectId: v.optional(v.id("projects")),
    visitorId: v.optional(v.id("visitors")),
    data: v.any(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastAccessedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_expires", ["expiresAt"])
    .index("by_user", ["userId"])
    .index("by_visitor", ["visitorId"]),

  /** Sliding-window rate limit counters (documented `rate_limits` table). */
  rateLimits: defineTable({
    bucketKey: v.string(),
    identityKey: v.string(),
    routePattern: v.string(),
    windowStart: v.number(),
    requestCount: v.number(),
  })
    .index("by_bucket", ["bucketKey", "windowStart"])
    .index("by_window", ["windowStart"]),

  /** Projects (documented `projects` table). */
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    storageAllocatedBytes: v.number(),
    freeVisitsPerMonth: v.number(),
    visitsUsedThisMonth: v.number(),
    visitsPeriodStart: v.number(),
    visitsOverage: v.number(),
    visitorAuthEnabled: v.boolean(),
    defaultVisitorRole: v.string(),
    signupEnabled: v.boolean(),
    watermarkEnabled: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"])
    .index("by_name", ["name"]),

  /** User-defined routes, including proxy routes (documented `routes` table). */
  routes: defineTable({
    projectId: v.id("projects"),
    pathPattern: v.string(),
    targetFile: v.optional(v.string()),
    isProxy: v.boolean(),
    proxyConfig: v.optional(v.any()),
    requiresAuth: v.boolean(),
    requiredRole: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_path", ["projectId", "pathPattern"]),

  /** Pre-defined API endpoint toggles (documented `api_endpoints` table). */
  apiEndpoints: defineTable({
    projectId: v.id("projects"),
    endpointName: v.string(),
    isEnabled: v.boolean(),
    requiresAuth: v.boolean(),
    requiredRole: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_endpoint", ["projectId", "endpointName"]),

  /** Custom + pre-defined roles (documented `roles` table). */
  roles: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    permissions: v.any(),
    isSystem: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_name", ["projectId", "name"]),

  /** Per-project visitor accounts (documented `visitors` table). */
  visitors: defineTable({
    projectId: v.id("projects"),
    username: v.string(),
    passwordHash: v.string(),
    roleId: v.optional(v.id("roles")),
    isActive: v.boolean(),
    failedLoginAttempts: v.number(),
    lockoutUntil: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_username", ["projectId", "username"]),

  /** Encrypted project secrets (documented `secrets` table). */
  secrets: defineTable({
    projectId: v.id("projects"),
    keyName: v.string(),
    encryptedValue: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_key", ["projectId", "keyName"]),

  /** Agent/API keys, storage-only scope (documented API key auth). */
  apiKeys: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    name: v.string(),
    roleName: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    isActive: v.boolean(),
    lastUsedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]),

  /** JSONB document store, per project + logical table (documented `project_data`). */
  projectData: defineTable({
    projectId: v.id("projects"),
    tableName: v.string(),
    documentId: v.string(),
    document: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_table", ["projectId", "tableName"])
    .index("by_project_table_doc", ["projectId", "tableName", "documentId"])
    .index("by_project", ["projectId"]),

  /** Logical tables registered in the dashboard (documented "New Table"). */
  dataTables: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  /** Built-in cron task configuration (documented `cron_configs` table). */
  cronConfigs: defineTable({
    projectId: v.id("projects"),
    taskName: v.string(),
    isEnabled: v.boolean(),
    parameters: v.any(),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    lastStatus: v.optional(v.string()),
    lastMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_task", ["projectId", "taskName"])
    .index("by_task", ["taskName"]),

  /** Cron execution history, surfaced in the dashboard. */
  cronRuns: defineTable({
    projectId: v.id("projects"),
    taskName: v.string(),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("skipped")),
    message: v.string(),
    affected: v.number(),
    startedAt: v.number(),
    finishedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_task", ["projectId", "taskName"]),

  /** Webhook endpoints (documented `webhooks` table). */
  webhooks: defineTable({
    projectId: v.id("projects"),
    url: v.string(),
    secret: v.optional(v.string()),
    events: v.array(v.string()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  /** Webhook delivery attempts (documented `webhook_deliveries` table). */
  webhookDeliveries: defineTable({
    webhookId: v.id("webhooks"),
    projectId: v.id("projects"),
    event: v.string(),
    payload: v.any(),
    responseStatus: v.optional(v.number()),
    responseBody: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    deliveredAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_webhook", ["webhookId"]),

  /** Custom domain registrations (documented `domains` table). */
  domains: defineTable({
    projectId: v.id("projects"),
    domain: v.string(),
    verificationToken: v.string(),
    isVerified: v.boolean(),
    sslStatus: v.union(v.literal("none"), v.literal("pending"), v.literal("active"), v.literal("failed")),
    sslExpiresAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    verificationMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_domain", ["domain"]),

  /** Raw visit logs (documented `visit_logs` table). */
  visitLogs: defineTable({
    projectId: v.id("projects"),
    route: v.string(),
    visitorId: v.optional(v.id("visitors")),
    sessionId: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    visitedAt: v.number(),
    isUnique: v.boolean(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_time", ["projectId", "visitedAt"]),

  /** Daily aggregated, anonymised stats (documented `daily_project_stats`). */
  dailyProjectStats: defineTable({
    date: v.string(),
    projectId: v.optional(v.id("projects")),
    totalVisits: v.number(),
    uniqueVisitors: v.number(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_project_date", ["projectId", "date"]),

  /** Admin-editable system configuration (documented `system_configs`). */
  systemConfigs: defineTable({
    configKey: v.string(),
    configValue: v.any(),
    description: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["configKey"]),

  /** Project storage files (documented local-disk file tree). */
  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    name: v.string(),
    directory: v.string(),
    size: v.number(),
    contentType: v.string(),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    isText: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_path", ["projectId", "path"])
    .index("by_project_dir", ["projectId", "directory"]),

  /** Per-user shared library assets (documented `/var/localme/storage/{userId}/library`). */
  libraryFiles: defineTable({
    userId: v.id("users"),
    path: v.string(),
    name: v.string(),
    size: v.number(),
    contentType: v.string(),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    isText: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_path", ["userId", "path"]),

  /** Admin-curated public library, served from `/~public/`. */
  publicLibraryFiles: defineTable({
    path: v.string(),
    name: v.string(),
    size: v.number(),
    contentType: v.string(),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    isText: v.boolean(),
    uploadedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_path", ["path"]),

  /** Math CAPTCHA challenges (documented SVG CAPTCHA). */
  captchas: defineTable({
    captchaId: v.string(),
    answer: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_captcha_id", ["captchaId"]),

  /** Deployment event log, mirrors structured Serilog output. */
  auditLogs: defineTable({
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    event: v.string(),
    message: v.string(),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.id("users")),
    context: v.any(),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_project", ["projectId"]),
});

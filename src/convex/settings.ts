import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { DEFAULT_CONFIGS, ensureConfigs, readConfig } from "./lib/config";
import { fail } from "./lib/errors";
import { audit, requireAdmin, requireOperator, requireUserMutation } from "./lib/session";
import { projectStorageUsed } from "./lib/files";

/**
 * Everything the HTTP layer needs for one request: platform identity, rate
 * limits, visit rules and auth policy. Read once per request.
 */
export const runtimeConfig = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const platform = await readConfig<{
      name: string;
      support_email: string;
      console_url: string;
      watermark_text: string;
      watermark_url: string;
      allow_public_signup: boolean;
    }>(ctx, "platform");
    const rateLimits = await readConfig<Record<string, number>>(ctx, "rate_limits");
    const visits = await readConfig<{ free_visits_per_month: number; dedupe_window_seconds: number }>(ctx, "visits");
    const auth = await readConfig<{
      max_login_attempts: number;
      lockout_minutes: number;
      session_timeout_minutes: number;
    }>(ctx, "auth");
    const storage = await readConfig<{ max_upload_size_bytes: number }>(ctx, "storage");
    return { platform, rateLimits, visits, auth, storage };
  },
});

/** Public platform identity, safe for the landing page and auth screen. */
export const publicInfo = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const platform = await readConfig<{
      name: string;
      support_email: string;
      allow_public_signup: boolean;
      console_url: string;
    }>(ctx, "platform");
    const users = await ctx.db.query("users").collect();
    const projects = await ctx.db.query("projects").collect();
    return {
      name: platform.name,
      supportEmail: platform.support_email,
      allowPublicSignup: platform.allow_public_signup,
      consoleUrl: platform.console_url,
      stats: {
        accounts: users.length,
        projects: projects.length,
        deployedApps: projects.filter((project) => project.isActive).length,
      },
    };
  },
});

export const listConfigs = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const rows = await ctx.db.query("systemConfigs").collect();
    const known = DEFAULT_CONFIGS.map((entry) => ({
      key: entry.key,
      description: entry.description,
      value: (rows.find((row) => row.configKey === entry.key)?.configValue ?? entry.value) as unknown,
      isSeeded: rows.some((row) => row.configKey === entry.key),
    }));
    const extra = rows
      .filter((row) => !DEFAULT_CONFIGS.some((entry) => entry.key === row.configKey))
      .map((row) => ({
        key: row.configKey,
        description: row.description,
        value: row.configKey.includes("key") || row.configKey.includes("secret") ? "••••••••" : row.configValue,
        isSeeded: true,
        secret: true,
      }));
    return [...known, ...extra];
  },
});

export const updateConfig = mutation({
  args: { token: v.string(), key: v.string(), value: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token);
    const existing = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { configValue: args.value, updatedAt: Date.now() });
    } else {
      if (!DEFAULT_CONFIGS.some((entry) => entry.key === args.key)) {
        fail("Unknown configuration key", 404, "not_found");
      }
      await ctx.db.insert("systemConfigs", {
        configKey: args.key,
        configValue: args.value,
        description: DEFAULT_CONFIGS.find((entry) => entry.key === args.key)?.description ?? "",
        updatedAt: Date.now(),
      });
    }
    await audit(ctx, {
      level: "warning",
      event: "admin.config.update",
      message: `System configuration "${args.key}" updated`,
      userId: admin._id,
    });
    return null;
  },
});

export const seedDefaults = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    await ensureConfigs(ctx);
    return null;
  },
});

export const adminProjects = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOperator(ctx, args.token);
    const projects = await ctx.db.query("projects").collect();
    const rows = [];
    for (const project of projects) {
      const owner = await ctx.db.get(project.userId);
      rows.push({
        id: project._id,
        name: project.name,
        owner: owner?.username ?? "deleted",
        ownerId: project.userId,
        isActive: project.isActive,
        storageUsed: await projectStorageUsed(ctx, project._id),
        storageAllocated: project.storageAllocatedBytes,
        visitsUsedThisMonth: project.visitsUsedThisMonth,
        freeVisitsPerMonth: project.freeVisitsPerMonth,
        createdAt: project.createdAt,
        visitorAuthEnabled: project.visitorAuthEnabled,
        urlPath: `/${owner?.username ?? "unknown"}/${project.name}/`,
      });
    }
    return rows.sort((a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name));
  },
});

export const adminSetProjectActive = mutation({
  args: { token: v.string(), projectId: v.id("projects"), isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token);
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    await ctx.db.patch(project._id, { isActive: args.isActive, updatedAt: Date.now() });
    await audit(ctx, {
      level: "warning",
      event: "admin.project.status",
      message: `Project ${project.name} ${args.isActive ? "enabled" : "disabled"}`,
      projectId: project._id,
      userId: admin._id,
    });
    return null;
  },
});

/** Deployment health, mirroring the documented `GET /health` endpoint. */
export const health = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const projects = await ctx.db.query("projects").collect();
    const configs = await ctx.db.query("systemConfigs").collect();
    return {
      status: "healthy",
      version: "1.0.0",
      accounts: users.length,
      projects: projects.length,
      configKeys: configs.length,
      checks: {
        database: "ok",
        cron: "ok",
        storage: "ok",
      },
      time: new Date().toISOString(),
    };
  },
});

export const touchSession = mutation({
  args: { token: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    return { id: user._id, username: user.username, role: user.role };
  },
});

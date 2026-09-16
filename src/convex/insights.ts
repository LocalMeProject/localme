import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { fail } from "./lib/errors";
import { readConfig } from "./lib/config";
import { storageCaps, userStorageUsed } from "./lib/files";
import { audit, requireAdmin, requireProjectOwnership, readPlatformUser } from "./lib/session";

function monthKey(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export type VisitResult = {
  counted: boolean;
  unique: boolean;
  overLimit: boolean;
  visitsUsed: number;
  freeVisits: number;
};

/**
 * Records a page visit for a project.
 *
 * Counts only HTML page serves, deduplicates within the configured window
 * (default five minutes, matched on project + route + client), resets the
 * monthly counter on the first visit of a period, and reports when the free
 * visit allowance is exhausted so the caller can answer `402`.
 */
export const recordVisit = mutation({
  args: {
    projectId: v.id("projects"),
    route: v.string(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    visitorId: v.optional(v.id("visitors")),
    sessionId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<VisitResult> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    const visits = await readConfig<{ free_visits_per_month: number; dedupe_window_seconds: number }>(
      ctx,
      "visits",
    );
    const now = Date.now();
    const periodStart = monthKey(now);
    let used = project.visitsUsedThisMonth;
    if (project.visitsPeriodStart < periodStart) used = 0;

    const recent = await ctx.db
      .query("visitLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", project._id))
      .order("desc")
      .take(50);
    const dedupeWindow = visits.dedupe_window_seconds * 1000;
    const duplicate = recent.some(
      (log) =>
        log.route === args.route &&
        now - log.visitedAt < dedupeWindow &&
        (log.ip ?? "") === (args.ip ?? "") &&
        (log.sessionId ?? "") === (args.sessionId ?? ""),
    );

    const overLimit = used >= project.freeVisitsPerMonth;
    if (overLimit) {
      return { counted: false, unique: false, overLimit: true, visitsUsed: used, freeVisits: project.freeVisitsPerMonth };
    }

    await ctx.db.insert("visitLogs", {
      projectId: project._id,
      route: args.route,
      visitorId: args.visitorId,
      sessionId: args.sessionId,
      ip: args.ip,
      userAgent: args.userAgent,
      visitedAt: now,
      isUnique: !duplicate,
    });

    const nextUsed = duplicate ? used : used + 1;
    await ctx.db.patch(project._id, {
      visitsUsedThisMonth: nextUsed,
      visitsPeriodStart: periodStart,
    });
    return {
      counted: !duplicate,
      unique: !duplicate,
      overLimit: false,
      visitsUsed: nextUsed,
      freeVisits: project.freeVisitsPerMonth,
    };
  },
});

export const projectSummary = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const logs = await ctx.db
      .query("visitLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", args.projectId))
      .collect();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return {
      project: project.name,
      visitsToday: logs.filter((log) => log.visitedAt >= today.getTime()).length,
      visitsThisMonth: project.visitsUsedThisMonth,
      uniqueVisitorsToday: new Set(
        logs.filter((log) => log.visitedAt >= today.getTime() && log.isUnique).map((log) => log.ip ?? "unknown"),
      ).size,
      totalLoggedVisits: logs.length,
    };
  },
});

export const allProjectIds = internalQuery({
  args: {},
  returns: v.array(v.id("projects")),
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    return projects.map((project) => project._id);
  },
});

/* ------------------------------------------------------------------ *
 * Dashboard: project usage
 * ------------------------------------------------------------------ */

export const projectUsage = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnership(ctx, args.token, args.projectId);
    const logs = await ctx.db
      .query("visitLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", args.projectId))
      .collect();
    const stats = await ctx.db
      .query("dailyProjectStats")
      .withIndex("by_project_date", (q) => q.eq("projectId", args.projectId))
      .collect();
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const series: { date: string; visits: number; unique: number }[] = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const day = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      const aggregate = stats.find((row) => row.date === key);
      const live = logs.filter(
        (log) => log.visitedAt >= day.getTime() && log.visitedAt < day.getTime() + 24 * 60 * 60 * 1000,
      );
      series.push({
        date: key,
        visits: Math.max(aggregate?.totalVisits ?? 0, live.length),
        unique: Math.max(aggregate?.uniqueVisitors ?? 0, new Set(live.filter((log) => log.isUnique).map((l) => l.ip)).size),
      });
    }

    return {
      visitsUsedThisMonth: project.visitsUsedThisMonth,
      freeVisitsPerMonth: project.freeVisitsPerMonth,
      remainingVisits: Math.max(project.freeVisitsPerMonth - project.visitsUsedThisMonth, 0),
      periodStart: project.visitsPeriodStart,
      totalLoggedVisits: logs.length,
      uniqueVisitors: new Set(logs.filter((log) => log.isUnique).map((log) => log.ip ?? "unknown")).size,
      visitsToday: logs.filter((log) => log.visitedAt >= today.getTime()).length,
      files: files.length,
      visitors: visitors.length,
      activeVisitors: visitors.filter((visitor) => visitor.isActive).length,
      series,
      recent: logs
        .sort((a, b) => b.visitedAt - a.visitedAt)
        .slice(0, 25)
        .map((log) => ({
          route: log.route,
          visitedAt: log.visitedAt,
          ip: log.ip ?? null,
          userAgent: log.userAgent ?? null,
          isUnique: log.isUnique,
          signedIn: Boolean(log.visitorId),
        })),
    };
  },
});

export const projectActivity = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(40);
    return logs.map((log) => ({
      id: log._id,
      level: log.level,
      event: log.event,
      message: log.message,
      createdAt: log.createdAt,
    }));
  },
});

export const projectOverview = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnership(ctx, args.token, args.projectId);
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const routes = await ctx.db
      .query("routes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const documents = await ctx.db
      .query("projectData")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(2000);
    const tables = new Set(documents.map((document) => document.tableName));
    const secrets = await ctx.db
      .query("secrets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return {
      files: files.length,
      storageUsed: files.reduce((sum, file) => sum + file.size, 0),
      storageAllocated: project.storageAllocatedBytes,
      routes: routes.length,
      proxyRoutes: routes.filter((route) => route.isProxy).length,
      visitors: visitors.length,
      webhooks: webhooks.length,
      tables: tables.size,
      documents: documents.length,
      secrets: secrets.length,
      domains: domains.length,
      visitsUsedThisMonth: project.visitsUsedThisMonth,
      freeVisitsPerMonth: project.freeVisitsPerMonth,
      hasIndexHtml: files.some((file) => file.path === "/index.html"),
      has404: files.some((file) => file.path === "/404.html"),
      hasServiceWorker: files.some((file) => file.path === "/sw.js"),
      hasManifest: files.some((file) => file.path === "/manifest.json"),
    };
  },
});

/* ------------------------------------------------------------------ *
 * Admin reporting
 * ------------------------------------------------------------------ */

export const adminOverview = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const users = await ctx.db.query("users").collect();
    const projects = await ctx.db.query("projects").collect();
    const logs = await ctx.db.query("visitLogs").collect();
    const documents = await ctx.db.query("projectData").collect();
    const files = await ctx.db.query("files").collect();
    const visitors = await ctx.db.query("visitors").collect();
    const deliveries = await ctx.db.query("webhookDeliveries").collect();
    const audits = await ctx.db.query("auditLogs").withIndex("by_created").order("desc").take(30);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const stats = await ctx.db.query("dailyProjectStats").collect();

    const series: { date: string; visits: number; unique: number }[] = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const day = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      const aggregate = stats.filter((row) => row.date === key);
      const live = logs.filter(
        (log) => log.visitedAt >= day.getTime() && log.visitedAt < day.getTime() + 24 * 60 * 60 * 1000,
      );
      series.push({
        date: key,
        visits: Math.max(
          aggregate.reduce((sum, row) => sum + row.totalVisits, 0),
          live.length,
        ),
        unique: Math.max(
          aggregate.reduce((sum, row) => sum + row.uniqueVisitors, 0),
          new Set(live.filter((log) => log.isUnique).map((log) => log.ip)).size,
        ),
      });
    }

    let storageTotal = 0;
    for (const user of users) storageTotal += await userStorageUsed(ctx, user._id);
    const caps = users.length > 0 ? await storageCaps(ctx, users[0]) : null;

    return {
      totals: {
        users: users.length,
        admins: users.filter((user) => user.role === "admin").length,
        operators: users.filter((user) => user.role === "operator").length,
        suspended: users.filter((user) => user.isSuspended).length,
        projects: projects.length,
        activeProjects: projects.filter((project) => project.isActive).length,
        visitors: visitors.length,
        documents: documents.length,
        files: files.length,
        storageBytes: storageTotal,
        visitsToday: logs.filter((log) => log.visitedAt >= today.getTime()).length,
        visits30d: logs.filter((log) => log.visitedAt >= today.getTime() - 29 * 24 * 60 * 60 * 1000).length,
        webhookDeliveries: deliveries.length,
        failedDeliveries: deliveries.filter((delivery) => delivery.errorMessage).length,
        defaultCapBytes: caps?.cap ?? 0,
      },
      series,
      audit: audits.map((entry) => ({
        id: entry._id,
        level: entry.level,
        event: entry.event,
        message: entry.message,
        createdAt: entry.createdAt,
      })),
      topProjects: await Promise.all(
        projects
          .slice(0, 5)
          .map(async (project) => ({
            id: project._id,
            name: project.name,
            visits: project.visitsUsedThisMonth,
            files: (await ctx.db
              .query("files")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect()).length,
          })),
      ),
    };
  },
});

/** Anonymous aggregated statistics, safe for operators to read. */
export const anonymousStats = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "operator")) fail("Forbidden", 403, "forbidden");
    const stats = await ctx.db.query("dailyProjectStats").collect();
    const byDate = new Map<string, { visits: number; unique: number }>();
    for (const row of stats) {
      const current = byDate.get(row.date) ?? { visits: 0, unique: 0 };
      byDate.set(row.date, {
        visits: current.visits + row.totalVisits,
        unique: current.unique + row.uniqueVisitors,
      });
    }
    return [...byDate.entries()]
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-90);
  },
});

export const platformTotals = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const projects = await ctx.db.query("projects").collect();
    return { users: users.length, projects: projects.length };
  },
});

/** Signup metrics for the admin dashboard (per-day account creation). */
export const signupSeries = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const users = await ctx.db.query("users").collect();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const series: { date: string; count: number }[] = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const day = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
      const next = day.getTime() + 24 * 60 * 60 * 1000;
      series.push({
        date: day.toISOString().slice(0, 10),
        count: users.filter((user) => user.createdAt >= day.getTime() && user.createdAt < next).length,
      });
    }
    return series;
  },
});

export const logAudit = mutation({
  args: { token: v.string(), event: v.string(), message: v.string(), level: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) fail("Authentication required", 401, "unauthenticated");
    await audit(ctx, {
      level: (args.level as "info" | "warning" | "error") ?? "info",
      event: args.event,
      message: args.message,
      userId: user._id,
    });
    return null;
  },
});

export type InsightsContext = MutationCtx;
export type ProjectId = Id<"projects">;

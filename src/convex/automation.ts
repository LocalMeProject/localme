import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { fail } from "./lib/errors";
import { CRON_TASKS, WEBHOOK_EVENTS } from "./lib/permissions";
import { signPayload, randomToken } from "./lib/crypto";
import { audit, requireProjectOwnership, requireProjectOwnershipMutation } from "./lib/session";
import { validateUrl } from "./lib/validation";
import { emitEvent } from "./lib/webhookBus";

type TaskName = (typeof CRON_TASKS)[number]["name"];

async function recordRun(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    taskName: string;
    status: "success" | "failed" | "skipped";
    message: string;
    affected: number;
    startedAt: number;
  },
): Promise<void> {
  await ctx.db.insert("cronRuns", {
    projectId: args.projectId,
    taskName: args.taskName,
    status: args.status,
    message: args.message,
    affected: args.affected,
    startedAt: args.startedAt,
    finishedAt: Date.now(),
  });
  const config = await ctx.db
    .query("cronConfigs")
    .withIndex("by_project_task", (q) => q.eq("projectId", args.projectId).eq("taskName", args.taskName))
    .unique();
  if (config) {
    await ctx.db.patch(config._id, {
      lastRunAt: Date.now(),
      lastStatus: args.status,
      lastMessage: args.message,
      updatedAt: Date.now(),
    });
  }
}

/* ------------------------------------------------------------------ *
 * Dashboard: cron configuration
 * ------------------------------------------------------------------ */

export const listCron = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const configs = await ctx.db
      .query("cronConfigs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const runs = await ctx.db
      .query("cronRuns")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(30);
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return {
      tasks: CRON_TASKS.map((task) => {
        const config = configs.find((candidate) => candidate.taskName === task.name);
        return {
          name: task.name,
          description: task.description,
          schedule: task.schedule,
          defaultParameters: task.defaultParameters,
          isEnabled: config?.isEnabled ?? true,
          parameters: (config?.parameters as Record<string, unknown>) ?? task.defaultParameters,
          lastRunAt: config?.lastRunAt ?? null,
          lastStatus: config?.lastStatus ?? null,
          lastMessage: config?.lastMessage ?? null,
        };
      }),
      runs: runs.map((run) => ({
        id: run._id,
        taskName: run.taskName,
        status: run.status,
        message: run.message,
        affected: run.affected,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.finishedAt - run.startedAt,
      })),
      webhookOptions: webhooks.map((webhook) => ({ id: webhook._id, url: webhook.url })),
    };
  },
});

export const updateCron = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    taskName: v.string(),
    isEnabled: v.optional(v.boolean()),
    parameters: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    if (!CRON_TASKS.some((task) => task.name === args.taskName)) fail("Unknown task", 404, "not_found");
    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_project_task", (q) => q.eq("projectId", project._id).eq("taskName", args.taskName))
      .unique();
    if (config) {
      await ctx.db.patch(config._id, {
        isEnabled: args.isEnabled ?? config.isEnabled,
        parameters: args.parameters ?? config.parameters,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("cronConfigs", {
        projectId: project._id,
        taskName: args.taskName,
        isEnabled: args.isEnabled ?? true,
        parameters: args.parameters ?? {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/** "Run now" support: queues one execution and returns immediately. */
export const runCronNow = mutation({
  args: { token: v.string(), projectId: v.id("projects"), taskName: v.string() },
  returns: v.object({ queued: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    switch (args.taskName) {
      case "CleanExpiredSessions":
        await ctx.scheduler.runAfter(0, internal.automation.jobCleanExpiredSessions, { projectId: project._id });
        break;
      case "CleanOldLogs":
        await ctx.scheduler.runAfter(0, internal.automation.jobCleanOldLogs, { projectId: project._id });
        break;
      case "GenerateDailyStats":
        await ctx.scheduler.runAfter(0, internal.automation.jobGenerateDailyStats, { projectId: project._id });
        break;
      case "SendDailySummaryWebhook":
        await ctx.scheduler.runAfter(0, internal.automation.jobSendDailySummary, { projectId: project._id });
        break;
      case "CleanOrphanedUploads":
        await ctx.scheduler.runAfter(0, internal.automation.jobCleanOrphanedUploads, { projectId: project._id });
        break;
      default:
        fail("Unknown task", 404, "not_found");
    }
    return { queued: true, message: `${args.taskName} queued` };
  },
});

/* ------------------------------------------------------------------ *
 * Job implementations
 * ------------------------------------------------------------------ */

async function projectEnabled(ctx: MutationCtx, projectId: Id<"projects">, taskName: string): Promise<boolean> {
  const config = await ctx.db
    .query("cronConfigs")
    .withIndex("by_project_task", (q) => q.eq("projectId", projectId).eq("taskName", taskName))
    .unique();
  return config ? config.isEnabled : true;
}

export const jobCleanExpiredSessions = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    if (!(await projectEnabled(ctx, args.projectId, "CleanExpiredSessions"))) {
      await recordRun(ctx, {
        projectId: args.projectId,
        taskName: "CleanExpiredSessions",
        status: "skipped",
        message: "Task disabled for this project",
        affected: 0,
        startedAt,
      });
      return null;
    }
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    let removed = 0;
    for (const visitor of visitors) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
        .collect();
      for (const session of sessions.filter((row) => row.expiresAt < Date.now())) {
        await ctx.db.delete(session._id);
        removed += 1;
      }
    }
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: "CleanExpiredSessions",
      status: "success",
      message: `Deleted ${removed} expired session(s)`,
      affected: removed,
      startedAt,
    });
    return null;
  },
});

export const jobCleanOldLogs = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    if (!(await projectEnabled(ctx, args.projectId, "CleanOldLogs"))) {
      await recordRun(ctx, {
        projectId: args.projectId,
        taskName: "CleanOldLogs",
        status: "skipped",
        message: "Task disabled for this project",
        affected: 0,
        startedAt,
      });
      return null;
    }
    const retention = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention"))
      .unique();
    const months =
      (retention?.configValue as { free_log_retention_months?: number } | undefined)?.free_log_retention_months ?? 3;
    const cutoff = Date.now() - months * 30 * 24 * 60 * 60 * 1000;
    const logs = await ctx.db
      .query("visitLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", args.projectId))
      .collect();
    const stale = logs.filter((log) => log.visitedAt < cutoff);
    for (const log of stale) await ctx.db.delete(log._id);
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: "CleanOldLogs",
      status: "success",
      message: `Removed ${stale.length} log(s) older than ${months} months`,
      affected: stale.length,
      startedAt,
    });
    return null;
  },
});

export const jobGenerateDailyStats = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    if (!(await projectEnabled(ctx, args.projectId, "GenerateDailyStats"))) {
      await recordRun(ctx, {
        projectId: args.projectId,
        taskName: "GenerateDailyStats",
        status: "skipped",
        message: "Task disabled for this project",
        affected: 0,
        startedAt,
      });
      return null;
    }
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const start = dayStart.getTime() - 24 * 60 * 60 * 1000;
    const end = dayStart.getTime();
    const date = new Date(start).toISOString().slice(0, 10);
    const logs = await ctx.db
      .query("visitLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", args.projectId))
      .collect();
    const window = logs.filter((log) => log.visitedAt >= start && log.visitedAt < end);
    const uniqueVisitors = new Set(window.filter((log) => log.isUnique).map((log) => log.ip ?? "unknown")).size;
    const existing = await ctx.db
      .query("dailyProjectStats")
      .withIndex("by_project_date", (q) => q.eq("projectId", args.projectId).eq("date", date))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        totalVisits: window.length,
        uniqueVisitors,
      });
    } else {
      await ctx.db.insert("dailyProjectStats", {
        date,
        projectId: args.projectId,
        totalVisits: window.length,
        uniqueVisitors,
        createdAt: Date.now(),
      });
    }
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: "GenerateDailyStats",
      status: "success",
      message: `Aggregated ${window.length} visit(s) for ${date}`,
      affected: window.length,
      startedAt,
    });
    return null;
  },
});

export const jobCleanOrphanedUploads = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    if (!(await projectEnabled(ctx, args.projectId, "CleanOrphanedUploads"))) {
      await recordRun(ctx, {
        projectId: args.projectId,
        taskName: "CleanOrphanedUploads",
        status: "skipped",
        message: "Task disabled for this project",
        affected: 0,
        startedAt,
      });
      return null;
    }
    // A file row whose blob never landed (an upload that was interrupted, or a
    // blob deleted out of band) can never be served again, so the record is
    // removed. Text-only files have no blob and are left alone.
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    let removed = 0;
    for (const file of files) {
      if (!file.storageId) continue;
      // `getMetadata` is the reader available inside a mutation: it returns null
      // for a blob that no longer exists, which is exactly the orphan case.
      const metadata = await ctx.storage.getMetadata(file.storageId);
      if (metadata) continue;
      await ctx.db.delete(file._id);
      removed += 1;
    }
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: "CleanOrphanedUploads",
      status: "success",
      message: `Removed ${removed} orphaned upload record(s)`,
      affected: removed,
      startedAt,
    });
    return null;
  },
});

export const jobSendDailySummary = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.automation.projectCronContext, { projectId: args.projectId });
    if (!context.enabled) {
      await ctx.runMutation(internal.automation.recordSkipped, {
        projectId: args.projectId,
        taskName: "SendDailySummaryWebhook",
      });
      return null;
    }
    const webhookId = String(context.parameters.webhook_id ?? "");
    const webhooks = context.webhooks as { id: string; url: string }[];
    // An explicitly configured webhook must exist; otherwise fall back to the
    // first active endpoint, and fail loudly when there is none at all.
    const webhook = webhookId
      ? webhooks.find((candidate) => candidate.id === webhookId)
      : webhooks[0];
    if (!webhook) {
      await ctx.runMutation(internal.automation.recordFailure, {
        projectId: args.projectId,
        taskName: "SendDailySummaryWebhook",
        message: webhookId
          ? `Configured webhook ${webhookId} is missing or inactive`
          : "No active webhook configured",
      });
      return null;
    }
    const summary = await ctx.runQuery(internal.insights.projectSummary, { projectId: args.projectId });
    await ctx.runAction(internal.automation.dispatchWebhook, {
      webhookId: webhook.id as Id<"webhooks">,
      event: "daily.summary",
      payload: {
        event: "daily.summary",
        timestamp: new Date().toISOString(),
        project_id: String(args.projectId),
        data: summary,
      },
    });
    await ctx.runMutation(internal.automation.recordSuccess, {
      projectId: args.projectId,
      taskName: "SendDailySummaryWebhook",
      message: `Summary delivered to ${webhook.url}`,
    });
    return null;
  },
});

export const projectCronContext = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_project_task", (q) => q.eq("projectId", args.projectId).eq("taskName", "SendDailySummaryWebhook"))
      .unique();
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return {
      enabled: config ? config.isEnabled : true,
      parameters: (config?.parameters as Record<string, unknown>) ?? {},
      webhooks: webhooks.filter((webhook) => webhook.isActive).map((webhook) => ({ id: webhook._id, url: webhook.url })),
    };
  },
});

export const recordSkipped = internalMutation({
  args: { projectId: v.id("projects"), taskName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: args.taskName,
      status: "skipped",
      message: "Task disabled for this project",
      affected: 0,
      startedAt: Date.now(),
    });
    return null;
  },
});

export const recordSuccess = internalMutation({
  args: { projectId: v.id("projects"), taskName: v.string(), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: args.taskName,
      status: "success",
      message: args.message,
      affected: 1,
      startedAt: Date.now(),
    });
    return null;
  },
});

export const recordFailure = internalMutation({
  args: { projectId: v.id("projects"), taskName: v.string(), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordRun(ctx, {
      projectId: args.projectId,
      taskName: args.taskName,
      status: "failed",
      message: args.message,
      affected: 0,
      startedAt: Date.now(),
    });
    await emitEvent(ctx, {
      projectId: args.projectId,
      event: "cron.failed",
      data: { task: args.taskName, message: args.message },
    });
    return null;
  },
});

/** Platform-wide sweep: every enabled project runs its due tasks. */
export const runDailyTask = internalAction({
  args: { taskName: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<{ ok: boolean; projects?: number; task?: string; reason?: string }> => {
    const projects = (await ctx.runQuery(internal.insights.allProjectIds, {})) as Id<"projects">[];
    for (const projectId of projects) {
      try {
        switch (args.taskName) {
          case "CleanExpiredSessions":
            await ctx.runMutation(internal.automation.jobCleanExpiredSessions, { projectId });
            break;
          case "CleanOldLogs":
            await ctx.runMutation(internal.automation.jobCleanOldLogs, { projectId });
            break;
          case "GenerateDailyStats":
            await ctx.runMutation(internal.automation.jobGenerateDailyStats, { projectId });
            break;
          case "SendDailySummaryWebhook":
            await ctx.runAction(internal.automation.jobSendDailySummary, { projectId });
            break;
          case "CleanOrphanedUploads":
            await ctx.runMutation(internal.automation.jobCleanOrphanedUploads, { projectId });
            break;
          default:
            return { ok: false, reason: "unknown task" };
        }
      } catch (error) {
        await ctx.runMutation(internal.automation.recordFailure, {
          projectId,
          taskName: args.taskName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { ok: true, projects: projects.length, task: args.taskName };
  },
});

/* ------------------------------------------------------------------ *
 * Webhooks
 * ------------------------------------------------------------------ */

export const listWebhooks = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(40);
    return {
      webhooks: webhooks
        .map((webhook) => ({
          id: webhook._id,
          url: webhook.url,
          events: webhook.events,
          hasSecret: Boolean(webhook.secret),
          isActive: webhook.isActive,
          description: webhook.description ?? "",
          createdAt: webhook.createdAt,
        }))
        .sort((a, b) => a.url.localeCompare(b.url)),
      deliveries: deliveries.map((delivery) => ({
        id: delivery._id,
        event: delivery.event,
        responseStatus: delivery.responseStatus ?? null,
        responseBody: delivery.responseBody ?? null,
        errorMessage: delivery.errorMessage ?? null,
        deliveredAt: delivery.deliveredAt,
      })),
      availableEvents: [...WEBHOOK_EVENTS],
    };
  },
});

export const createWebhook = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    url: v.string(),
    secret: v.optional(v.string()),
    events: v.array(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const url = validateUrl(args.url);
    const existing = await ctx.db
      .query("webhooks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    if (existing.length >= 20) fail("A project can have at most 20 webhooks", 400, "webhook_limit");
    const events = args.events.filter((event) => (WEBHOOK_EVENTS as readonly string[]).includes(event));
    if (events.length === 0) fail("Select at least one event", 400, "invalid_events");
    const now = Date.now();
    const id = await ctx.db.insert("webhooks", {
      projectId: project._id,
      url,
      secret: args.secret || undefined,
      events,
      description: args.description?.slice(0, 200),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, {
      level: "info",
      event: "webhook.created",
      message: `Webhook registered for ${events.join(", ")}`,
      projectId: project._id,
      userId: user._id,
    });
    return { id };
  },
});

export const updateWebhook = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    webhookId: v.id("webhooks"),
    url: v.optional(v.string()),
    secret: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.projectId !== project._id) fail("Webhook not found", 404, "not_found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.url !== undefined) patch.url = validateUrl(args.url);
    if (args.secret !== undefined) patch.secret = args.secret || undefined;
    if (args.events !== undefined) {
      const events = args.events.filter((event) => (WEBHOOK_EVENTS as readonly string[]).includes(event));
      if (events.length === 0) fail("Select at least one event", 400, "invalid_events");
      patch.events = events;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.description !== undefined) patch.description = args.description.slice(0, 200);
    await ctx.db.patch(webhook._id, patch);
    return null;
  },
});

export const deleteWebhook = mutation({
  args: { token: v.string(), projectId: v.id("projects"), webhookId: v.id("webhooks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.projectId !== project._id) return null;
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", webhook._id))
      .collect();
    for (const delivery of deliveries) await ctx.db.delete(delivery._id);
    await ctx.db.delete(webhook._id);
    return null;
  },
});

export const testWebhook = action({
  args: { token: v.string(), projectId: v.id("projects"), webhookId: v.id("webhooks") },
  returns: v.any(),
  handler: async (ctx, args): Promise<{ sent: boolean; url: string }> => {
    const webhook = (await ctx.runMutation(internal.automation.webhookForTest, {
      token: args.token,
      projectId: args.projectId,
      webhookId: args.webhookId,
    })) as { url: string };
    const payload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      project_id: String(args.projectId),
      data: { message: "This is a LocalMe test delivery", token: randomToken(4) },
    };
    await ctx.runAction(internal.automation.dispatchWebhook, {
      webhookId: args.webhookId,
      event: "webhook.test",
      payload,
    });
    return { sent: true, url: webhook.url };
  },
});

export const webhookForTest = internalMutation({
  args: { token: v.string(), projectId: v.id("projects"), webhookId: v.id("webhooks") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.projectId !== project._id) fail("Webhook not found", 404, "not_found");
    return { url: webhook.url };
  },
});

export const dispatchWebhook = internalAction({
  args: { webhookId: v.id("webhooks"), event: v.string(), payload: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const webhook = await ctx.runMutation(internal.automation.loadWebhook, { webhookId: args.webhookId });
    if (!webhook || !webhook.isActive) return null;
    const body = JSON.stringify(args.payload);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "LocalMe-Webhooks/1.0",
      "x-localme-event": args.event,
    };
    if (webhook.secret) headers["x-webhook-signature"] = signPayload(body, webhook.secret);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      const text = (await response.text()).slice(0, 2000);
      await ctx.runMutation(internal.automation.recordDelivery, {
        webhookId: args.webhookId,
        projectId: webhook.projectId,
        event: args.event,
        payload: args.payload,
        responseStatus: response.status,
        responseBody: text,
      });
    } catch (error) {
      await ctx.runMutation(internal.automation.recordDelivery, {
        webhookId: args.webhookId,
        projectId: webhook.projectId,
        event: args.event,
        payload: args.payload,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
    return null;
  },
});

export const loadWebhook = internalMutation({
  args: { webhookId: v.id("webhooks") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) return null;
    return { url: webhook.url, secret: webhook.secret, isActive: webhook.isActive, projectId: webhook.projectId };
  },
});

export const recordDelivery = internalMutation({
  args: {
    webhookId: v.id("webhooks"),
    projectId: v.id("projects"),
    event: v.string(),
    payload: v.any(),
    responseStatus: v.optional(v.number()),
    responseBody: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveries", {
      webhookId: args.webhookId,
      projectId: args.projectId,
      event: args.event,
      payload: args.payload,
      responseStatus: args.responseStatus,
      responseBody: args.responseBody,
      errorMessage: args.errorMessage,
      deliveredAt: Date.now(),
    });
    return null;
  },
});

export type AutomationTask = TaskName;

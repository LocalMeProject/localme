import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { readConfig } from "./lib/config";
import { DEFAULT_ROUTES, defaultCronRows, defaultEndpointRows, seedFiles } from "./lib/defaults";
import { fail } from "./lib/errors";
import { projectStorageUsed } from "./lib/files";
import { DEFAULT_ROLES } from "./lib/permissions";
import {
  audit,
  isAdmin,
  permissionSummary,
  readPlatformUser,
  requireProjectOwnershipMutation,
  requireUser,
  requireUserMutation,
} from "./lib/session";
import { validateProjectName } from "./lib/validation";
import { emitEvent } from "./lib/webhookBus";

export type ProjectSummary = {
  id: Id<"projects">;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  urlPath: string;
  visitsUsedThisMonth: number;
  freeVisitsPerMonth: number;
  storageUsed: number;
  storageCapBytes: number;
  visitorAuthEnabled: boolean;
  watermarkEnabled: boolean;
};

export async function toProjectSummary(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">,
  ownerUsername: string,
): Promise<ProjectSummary> {
  return {
    id: project._id,
    name: project.name,
    description: project.description,
    isActive: project.isActive,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    urlPath: `/${ownerUsername}/${project.name}/`,
    visitsUsedThisMonth: project.visitsUsedThisMonth,
    freeVisitsPerMonth: project.freeVisitsPerMonth,
    storageUsed: await projectStorageUsed(ctx, project._id),
    storageCapBytes: project.storageAllocatedBytes,
    visitorAuthEnabled: project.visitorAuthEnabled,
    watermarkEnabled: project.watermarkEnabled,
  };
}

/** Seeds roles, routes, endpoint toggles, cron configs and starter files. */
export async function scaffoldProject(
  ctx: MutationCtx,
  project: Doc<"projects">,
  ownerUsername: string,
): Promise<void> {
  const now = Date.now();
  for (const role of DEFAULT_ROLES) {
    await ctx.db.insert("roles", {
      projectId: project._id,
      name: role.name,
      permissions: role.permissions,
      isSystem: role.isSystem,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const route of DEFAULT_ROUTES) {
    await ctx.db.insert("routes", {
      projectId: project._id,
      pathPattern: route.pathPattern,
      targetFile: route.targetFile,
      isProxy: false,
      requiresAuth: route.requiresAuth,
      requiredRole: route.requiredRole,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const endpoint of defaultEndpointRows()) {
    await ctx.db.insert("apiEndpoints", {
      projectId: project._id,
      endpointName: endpoint.endpointName,
      isEnabled: endpoint.isEnabled,
      requiresAuth: endpoint.requiresAuth,
      requiredRole: endpoint.requiredRole,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const row of defaultCronRows()) {
    await ctx.db.insert("cronConfigs", {
      projectId: project._id,
      taskName: row.taskName,
      isEnabled: row.isEnabled,
      parameters: row.parameters,
      createdAt: now,
      updatedAt: now,
    });
  }
  const platform = await readConfig<{ console_url: string }>(ctx, "platform");
  for (const file of seedFiles(project.name, ownerUsername, platform.console_url || undefined)) {
    await ctx.db.insert("files", {
      projectId: project._id,
      path: file.path,
      name: file.path.slice(1),
      directory: "/",
      size: file.text.length,
      contentType: file.contentType,
      text: file.text,
      isText: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  await emitEvent(ctx, {
    projectId: project._id,
    event: "project.created",
    data: { name: project.name, owner: ownerUsername },
  });
}

/* ------------------------------------------------------------------ *
 * Dashboard queries
 * ------------------------------------------------------------------ */

export const list = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const rows = [];
    for (const project of projects) {
      rows.push(await toProjectSummary(ctx, project, user.username));
    }
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    if (project.userId !== user._id && !isAdmin(user)) fail("Forbidden", 403, "forbidden");
    const owner = await ctx.db.get(project.userId);
    const summary = await toProjectSummary(ctx, project, owner?.username ?? "unknown");
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const ownerRole = roles.find((role) => role.name === "Owner");
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    return {
      ...summary,
      signupEnabled: project.signupEnabled,
      defaultVisitorRole: project.defaultVisitorRole,
      ownerUsername: owner?.username ?? "unknown",
      ownerId: project.userId,
      visitorsTotal: visitors.length,
      permissions: permissionSummary((ownerRole?.permissions as Record<string, boolean> | undefined) ?? {}),
    };
  },
});

/** Public project lookup, used by the hosted-app viewer and the landing page. */
export const publicInfo = query({
  args: { username: v.string(), name: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!owner) return null;
    const project = await ctx.db
      .query("projects")
      .withIndex("by_user_name", (q) => q.eq("userId", owner._id).eq("name", args.name))
      .unique();
    if (!project) return null;
    const routes = await ctx.db
      .query("routes")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    return {
      name: project.name,
      owner: owner.username,
      urlPath: `/${owner.username}/${project.name}/`,
      isActive: project.isActive,
      visitorAuthEnabled: project.visitorAuthEnabled,
      watermarkEnabled: project.watermarkEnabled,
      createdAt: project.createdAt,
      routes: routes
        .filter((route) => route.isActive && !route.isProxy)
        .map((route) => ({
          path: route.pathPattern,
          requiresAuth: route.requiresAuth,
          requiredRole: route.requiredRole,
        })),
    };
  },
});

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

export const create = mutation({
  args: { token: v.string(), name: v.string(), description: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    const name = validateProjectName(args.name);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user_name", (q) => q.eq("userId", user._id).eq("name", name))
      .unique();
    if (existing) fail("You already have a project with that name", 409, "project_exists");
    const visits = await readConfig<{ free_visits_per_month: number }>(ctx, "visits");
    const storage = await readConfig<{ default_user_cap_bytes: number }>(ctx, "storage");
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      userId: user._id,
      name,
      description: args.description?.slice(0, 280),
      storageAllocatedBytes: storage.default_user_cap_bytes,
      freeVisitsPerMonth: visits.free_visits_per_month,
      visitsUsedThisMonth: 0,
      visitsPeriodStart: now,
      visitsOverage: 0,
      visitorAuthEnabled: true,
      defaultVisitorRole: "Member",
      signupEnabled: true,
      watermarkEnabled: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const project = (await ctx.db.get(projectId))!;
    await scaffoldProject(ctx, project, user.username);
    await audit(ctx, {
      level: "info",
      event: "project.created",
      message: `Project ${name} created`,
      projectId,
      userId: user._id,
    });
    return await toProjectSummary(ctx, project, user.username);
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    description: v.optional(v.string()),
    visitorAuthEnabled: v.optional(v.boolean()),
    signupEnabled: v.optional(v.boolean()),
    defaultVisitorRole: v.optional(v.string()),
    watermarkEnabled: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const patch: Partial<Doc<"projects">> = { updatedAt: Date.now() };
    if (args.description !== undefined) patch.description = args.description.slice(0, 280);
    if (args.visitorAuthEnabled !== undefined) patch.visitorAuthEnabled = args.visitorAuthEnabled;
    if (args.signupEnabled !== undefined) patch.signupEnabled = args.signupEnabled;
    if (args.defaultVisitorRole !== undefined) patch.defaultVisitorRole = args.defaultVisitorRole;
    if (args.watermarkEnabled !== undefined) patch.watermarkEnabled = args.watermarkEnabled;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.projectId, patch);
    await emitEvent(ctx, {
      projectId: args.projectId,
      event: "project.updated",
      data: { changes: Object.keys(patch).filter((key) => key !== "updatedAt") },
    });
    return null;
  },
});

/**
 * Project deletion removes every associated record and file recursively and
 * permanently — there is no trash can (P-31).
 */
export const remove = mutation({
  args: { token: v.string(), projectId: v.id("projects"), confirmName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    if (project.userId !== user._id && user.role !== "admin") fail("Forbidden", 403, "forbidden");
    if (args.confirmName !== project.name) {
      fail("Type the project name exactly to confirm deletion", 400, "confirmation_required");
    }
    await emitEvent(ctx, {
      projectId: project._id,
      event: "project.deleted",
      data: { name: project.name },
    });
    await ctx.scheduler.runAfter(0, internal.transfer.purgeProjectData, { projectId: project._id });
    await ctx.db.delete(project._id);
    await audit(ctx, {
      level: "warning",
      event: "project.deleted",
      message: `Project ${project.name} and all associated data deleted`,
      userId: user._id,
    });
    return null;
  },
});

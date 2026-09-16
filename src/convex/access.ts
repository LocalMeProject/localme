import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { readConfig } from "./lib/config";
import { hashPassword } from "./lib/crypto";
import { fail } from "./lib/errors";
import { ALL_PERMISSIONS, PERMISSION_LABELS, type Permission } from "./lib/permissions";
import {
  audit,
  createApiKeyRecord,
  permissionSummary,
  requireProjectOwnership,
  requireProjectOwnershipMutation,
} from "./lib/session";
import { validatePassword, validateRoleName, validateVisitorUsername } from "./lib/validation";

/* ------------------------------------------------------------------ *
 * Roles & permissions
 * ------------------------------------------------------------------ */

export const listRoles = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return roles
      .map((role) => ({
        id: role._id,
        name: role.name,
        isSystem: role.isSystem,
        permissions: (role.permissions as Record<string, boolean>) ?? {},
        permissionList: permissionSummary((role.permissions as Record<string, boolean>) ?? {}),
        visitorCount: visitors.filter((visitor) => visitor.roleId === role._id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const permissionCatalog = query({
  args: {},
  returns: v.any(),
  handler: () => ALL_PERMISSIONS.map((name) => ({ name, label: PERMISSION_LABELS[name as Permission] })),
});

export const createRole = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const name = validateRoleName(args.name);
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_project_name", (q) => q.eq("projectId", args.projectId).eq("name", name))
      .unique();
    if (existing) fail("A role with that name already exists", 409, "role_exists");
    const now = Date.now();
    const permissions: Record<string, boolean> = {};
    for (const permission of ALL_PERMISSIONS) permissions[permission] = args.permissions.includes(permission);
    const roleId = await ctx.db.insert("roles", {
      projectId: args.projectId,
      name,
      permissions,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    return { id: roleId, name };
  },
});

export const updateRole = mutation({
  args: { token: v.string(), projectId: v.id("projects"), roleId: v.id("roles"), permissions: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const role = await ctx.db.get(args.roleId);
    if (!role || role.projectId !== args.projectId) fail("Role not found", 404, "not_found");
    if (role.name === "Owner") fail("The Owner role cannot be modified", 400, "invalid_operation");
    const permissions: Record<string, boolean> = {};
    for (const permission of ALL_PERMISSIONS) permissions[permission] = args.permissions.includes(permission);
    await ctx.db.patch(role._id, { permissions, updatedAt: Date.now() });
    return null;
  },
});

export const deleteRole = mutation({
  args: { token: v.string(), projectId: v.id("projects"), roleId: v.id("roles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const role = await ctx.db.get(args.roleId);
    if (!role || role.projectId !== args.projectId) fail("Role not found", 404, "not_found");
    if (role.isSystem) fail("Built-in roles cannot be deleted", 400, "invalid_operation");
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const visitor of visitors) {
      if (visitor.roleId === role._id) await ctx.db.patch(visitor._id, { roleId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.delete(role._id);
    return null;
  },
});

async function roleIdForName(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">, name: string) {
  const role = await ctx.db
    .query("roles")
    .withIndex("by_project_name", (q) => q.eq("projectId", projectId).eq("name", name))
    .unique();
  return role?._id;
}

/* ------------------------------------------------------------------ *
 * Visitor accounts
 * ------------------------------------------------------------------ */

export const listVisitors = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const roleNames = new Map(roles.map((role) => [role._id, role.name]));
    return visitors
      .map((visitor) => ({
        id: visitor._id,
        username: visitor.username,
        roleId: visitor.roleId ?? null,
        roleName: visitor.roleId ? (roleNames.get(visitor.roleId) ?? "Guest") : "Guest",
        isActive: visitor.isActive,
        createdAt: visitor.createdAt,
        lastLoginAt: visitor.lastLoginAt ?? null,
        locked: Boolean(visitor.lockoutUntil && visitor.lockoutUntil > Date.now()),
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  },
});

export const createVisitor = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    username: v.string(),
    password: v.string(),
    roleName: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const username = validateVisitorUsername(args.username);
    const password = validatePassword(args.password);
    const existing = await ctx.db
      .query("visitors")
      .withIndex("by_project_username", (q) => q.eq("projectId", project._id).eq("username", username))
      .unique();
    if (existing) fail("That visitor username is already taken in this project", 409, "visitor_exists");
    const roleId = await roleIdForName(ctx, project._id, args.roleName);
    const now = Date.now();
    const id = await ctx.db.insert("visitors", {
      projectId: project._id,
      username,
      passwordHash: await hashPassword(password),
      roleId,
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { id, username };
  },
});

export const updateVisitor = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    visitorId: v.id("visitors"),
    roleName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    password: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.projectId !== project._id) fail("Visitor not found", 404, "not_found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.roleName !== undefined) patch.roleId = await roleIdForName(ctx, project._id, args.roleName);
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.password !== undefined) {
      patch.passwordHash = await hashPassword(validatePassword(args.password));
      patch.failedLoginAttempts = 0;
      patch.lockoutUntil = undefined;
    }
    await ctx.db.patch(visitor._id, patch);
    return null;
  },
});

export const deleteVisitor = mutation({
  args: { token: v.string(), projectId: v.id("projects"), visitorId: v.id("visitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.projectId !== project._id) return null;
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(visitor._id);
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * API keys (storage-only scope, P-12)
 * ------------------------------------------------------------------ */

export const listApiKeys = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return keys.map((key) => ({
      id: key._id,
      name: key.name,
      prefix: key.keyPrefix,
      roleName: key.roleName,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt ?? null,
      expiresAt: key.expiresAt,
      expired: key.expiresAt < Date.now(),
    }));
  },
});

export const createApiKey = mutation({
  args: { token: v.string(), projectId: v.id("projects"), name: v.string(), roleName: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const auth = await readConfig<{ api_key_expiry_days: number }>(ctx, "auth");
    const { rawKey, prefix } = await createApiKeyRecord(ctx, {
      projectId: project._id,
      userId: user._id,
      name: args.name.trim().slice(0, 64) || "API key",
      roleName: args.roleName,
      expiryDays: auth.api_key_expiry_days,
    });
    await audit(ctx, {
      level: "info",
      event: "api_key.created",
      message: `API key ${prefix}… created for ${project.name}`,
      projectId: project._id,
      userId: user._id,
    });
    return { rawKey, prefix };
  },
});

export const revokeApiKey = mutation({
  args: { token: v.string(), projectId: v.id("projects"), keyId: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.projectId !== project._id) return null;
    await ctx.db.patch(key._id, { isActive: false });
    return null;
  },
});

/** Regenerates a visitor password and returns the new credentials to the owner. */
export const resetVisitorPassword = mutation({
  args: { token: v.string(), projectId: v.id("projects"), visitorId: v.id("visitors") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.projectId !== project._id) fail("Visitor not found", 404, "not_found");
    const password = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
    await ctx.db.patch(visitor._id, {
      passwordHash: await hashPassword(password),
      failedLoginAttempts: 0,
      lockoutUntil: undefined,
      updatedAt: Date.now(),
    });
    return { username: visitor.username, password };
  },
});

/** Project owners can review every live visitor session for their project. */
export const visitorSessions = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const names = new Map(visitors.map((visitor) => [visitor._id, visitor.username]));
    const sessions = [];
    for (const visitor of visitors) {
      const rows = await ctx.db
        .query("sessions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
        .collect();
      for (const row of rows) if (row.expiresAt > Date.now()) sessions.push(row);
    }
    return sessions
      .map((session) => ({
        id: session._id,
        visitor: session.visitorId ? (names.get(session.visitorId) ?? "deleted") : "unknown",
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ip: session.ip ?? null,
        userAgent: session.userAgent ?? null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Owner-triggered session revocation for a project. */
export const revokeVisitorSessions = mutation({
  args: { token: v.string(), projectId: v.id("projects") },
  returns: v.object({ revoked: v.number() }),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const targets = [];
    for (const visitor of visitors) {
      const rows = await ctx.db
        .query("sessions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
        .collect();
      targets.push(...rows);
    }
    for (const session of targets) await ctx.db.delete(session._id);
    await audit(ctx, {
      level: "warning",
      event: "visitor.sessions.revoked",
      message: `Revoked ${targets.length} visitor session(s)`,
      projectId: project._id,
      userId: user._id,
    });
    return { revoked: targets.length };
  },
});

export const rotateProjectSecrets = mutation({
  args: { token: v.string(), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    for (const visitor of visitors) {
      const rows = await ctx.db
        .query("sessions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
        .collect();
      for (const session of rows) await ctx.db.delete(session._id);
    }
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    for (const key of keys) await ctx.db.patch(key._id, { isActive: false });
    return { revokedKeys: keys.length };
  },
});

export const memberOverview = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnership(ctx, args.token, args.projectId);
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    return {
      visitors: visitors.length,
      activeVisitors: visitors.filter((visitor) => visitor.isActive).length,
      apiKeys: keys.filter((key) => key.isActive && key.expiresAt > Date.now()).length,
      totalApiKeys: keys.length,
      signupEnabled: project.signupEnabled,
      visitorAuthEnabled: project.visitorAuthEnabled,
      defaultVisitorRole: project.defaultVisitorRole,
    };
  },
});

export const visitorLoginActivity = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects"), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const visits = await ctx.db
      .query("visitLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(Math.min(args.limit ?? 25, 100));
    return visits.map((visit) => ({
      route: visit.route,
      visitedAt: visit.visitedAt,
      ip: visit.ip ?? null,
      userAgent: visit.userAgent ?? null,
      isUnique: visit.isUnique,
      signedIn: Boolean(visit.visitorId),
    }));
  },
});


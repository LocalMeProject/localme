import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { fail } from "./lib/errors";
import { API_ENDPOINTS, ENDPOINT_PERMISSION } from "./lib/permissions";
import { isReservedPath, matchRoutePattern, normalizeStoragePath } from "./lib/paths";
import { requireProjectOwnership, requireProjectOwnershipMutation } from "./lib/session";
import { validateRoutePath, validateUrl } from "./lib/validation";

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

export const list = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const routes = await ctx.db
      .query("routes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const htmlFiles = files.filter((file) => file.contentType.startsWith("text/html")).map((file) => file.path);
    return {
      routes: routes
        .map((route) => ({
          id: route._id,
          pathPattern: route.pathPattern,
          targetFile: route.targetFile ?? null,
          isProxy: route.isProxy,
          proxyConfig: route.proxyConfig ?? null,
          requiresAuth: route.requiresAuth,
          requiredRole: route.requiredRole ?? null,
          isActive: route.isActive,
          updatedAt: route.updatedAt,
          targetMissing: Boolean(route.targetFile) && !htmlFiles.includes(route.targetFile as string),
        }))
        .sort((a, b) => a.pathPattern.localeCompare(b.pathPattern)),
      htmlFiles: htmlFiles.sort(),
      reservedPrefixes: ["/api", "/auth", "/admin", "/dashboard", "/library", "/~public"],
    };
  },
});

function validateProxyConfig(proxyConfig: unknown) {
  if (!proxyConfig || typeof proxyConfig !== "object") fail("Proxy configuration is required", 400, "invalid_proxy");
  const config = proxyConfig as Record<string, unknown>;
  const target = validateUrl(config.target);
  const method = typeof config.method === "string" ? config.method.toUpperCase() : "POST";
  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
  if (!allowedMethods.includes(method)) fail("Unsupported proxy method", 400, "invalid_proxy");
  const headers = (config.headers ?? {}) as Record<string, string>;
  const timeout = Number(config.timeout_seconds ?? 30);
  return {
    target,
    method,
    headers,
    timeout_seconds: Math.min(Math.max(timeout, 1), 60),
  };
}

export const create = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    pathPattern: v.string(),
    targetFile: v.optional(v.string()),
    isProxy: v.boolean(),
    proxyConfig: v.optional(v.any()),
    requiresAuth: v.boolean(),
    requiredRole: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const pathPattern = validateRoutePath(args.pathPattern);
    if (isReservedPath(pathPattern)) {
      fail("That path is reserved by the platform", 400, "reserved_path");
    }
    const existing = await ctx.db
      .query("routes")
      .withIndex("by_project_path", (q) => q.eq("projectId", project._id).eq("pathPattern", pathPattern))
      .unique();
    if (existing) fail("A route with that path already exists", 409, "route_exists");
    if (args.isProxy) {
      if (!args.proxyConfig) fail("Proxy configuration is required", 400, "invalid_proxy");
      const proxyConfig = validateProxyConfig(args.proxyConfig);
      const now = Date.now();
      const id = await ctx.db.insert("routes", {
        projectId: project._id,
        pathPattern,
        targetFile: undefined,
        isProxy: true,
        proxyConfig,
        requiresAuth: args.requiresAuth,
        requiredRole: args.requiredRole,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return { id, pathPattern };
    }
    if (!args.targetFile) fail("Select a target HTML file", 400, "invalid_target");
    const target = normalizeStoragePath(args.targetFile);
    if (!target.endsWith(".html") && !target.endsWith(".htm")) {
      fail("Only HTML files can be routed (P-22)", 400, "invalid_target");
    }
    const now = Date.now();
    const id = await ctx.db.insert("routes", {
      projectId: project._id,
      pathPattern,
      targetFile: target,
      isProxy: false,
      proxyConfig: undefined,
      requiresAuth: args.requiresAuth,
      requiredRole: args.requiredRole,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return { id, pathPattern };
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    routeId: v.id("routes"),
    pathPattern: v.optional(v.string()),
    targetFile: v.optional(v.string()),
    isProxy: v.optional(v.boolean()),
    proxyConfig: v.optional(v.any()),
    requiresAuth: v.optional(v.boolean()),
    requiredRole: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const route = await ctx.db.get(args.routeId);
    if (!route || route.projectId !== project._id) fail("Route not found", 404, "not_found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.pathPattern !== undefined) {
      const pathPattern = validateRoutePath(args.pathPattern);
      if (isReservedPath(pathPattern)) fail("That path is reserved by the platform", 400, "reserved_path");
      if (pathPattern !== route.pathPattern) {
        const clash = await ctx.db
          .query("routes")
          .withIndex("by_project_path", (q) => q.eq("projectId", project._id).eq("pathPattern", pathPattern))
          .unique();
        if (clash) fail("A route with that path already exists", 409, "route_exists");
      }
      patch.pathPattern = pathPattern;
    }
    if (args.targetFile !== undefined) {
      const target = normalizeStoragePath(args.targetFile);
      if (!target.endsWith(".html") && !target.endsWith(".htm")) {
        fail("Only HTML files can be routed (P-22)", 400, "invalid_target");
      }
      patch.targetFile = target;
    }
    // A route can be switched between serving a file and forwarding to an API;
    // the field that no longer applies is cleared so stale config cannot leak
    // into resolution.
    if (args.isProxy !== undefined && args.isProxy !== route.isProxy) {
      if (args.isProxy) {
        if (!args.proxyConfig) fail("Proxy configuration is required", 400, "invalid_proxy");
        patch.isProxy = true;
        patch.proxyConfig = validateProxyConfig(args.proxyConfig);
        patch.targetFile = undefined;
      } else {
        const target = args.targetFile ? normalizeStoragePath(args.targetFile) : route.targetFile;
        if (!target) fail("Select a target HTML file", 400, "invalid_target");
        if (!target.endsWith(".html") && !target.endsWith(".htm")) {
          fail("Only HTML files can be routed (P-22)", 400, "invalid_target");
        }
        patch.isProxy = false;
        patch.proxyConfig = undefined;
        patch.targetFile = target;
      }
    }
    if (args.proxyConfig !== undefined && (args.isProxy === undefined || args.isProxy)) {
      patch.proxyConfig = validateProxyConfig(args.proxyConfig);
    }
    if (args.requiresAuth !== undefined) patch.requiresAuth = args.requiresAuth;
    if (args.requiredRole !== undefined) patch.requiredRole = args.requiredRole || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(route._id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), projectId: v.id("projects"), routeId: v.id("routes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const route = await ctx.db.get(args.routeId);
    if (!route || route.projectId !== project._id) return null;
    if (route.pathPattern === "/") fail("The homepage route cannot be deleted", 400, "invalid_operation");
    await ctx.db.delete(route._id);
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * API endpoint toggles
 * ------------------------------------------------------------------ */

export const listEndpoints = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const rows = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return API_ENDPOINTS.map((endpoint) => {
      const row = rows.find((candidate) => candidate.endpointName === endpoint.name);
      return {
        name: endpoint.name,
        description: endpoint.description,
        permission: ENDPOINT_PERMISSION[endpoint.name] ?? "db_read",
        isEnabled: row?.isEnabled ?? true,
        requiresAuth: row?.requiresAuth ?? true,
        requiredRole: row?.requiredRole ?? "Member",
      };
    });
  },
});

export const updateEndpoint = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    endpointName: v.string(),
    isEnabled: v.optional(v.boolean()),
    requiresAuth: v.optional(v.boolean()),
    requiredRole: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    if (!API_ENDPOINTS.some((endpoint) => endpoint.name === args.endpointName)) {
      fail("Unknown endpoint", 404, "not_found");
    }
    const row = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_project_endpoint", (q) =>
        q.eq("projectId", project._id).eq("endpointName", args.endpointName),
      )
      .unique();
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.isEnabled !== undefined) patch.isEnabled = args.isEnabled;
    if (args.requiresAuth !== undefined) patch.requiresAuth = args.requiresAuth;
    if (args.requiredRole !== undefined) patch.requiredRole = args.requiredRole;
    if (row) {
      await ctx.db.patch(row._id, patch);
    } else {
      await ctx.db.insert("apiEndpoints", {
        projectId: project._id,
        endpointName: args.endpointName,
        isEnabled: args.isEnabled ?? true,
        requiresAuth: args.requiresAuth ?? true,
        requiredRole: args.requiredRole ?? "Member",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * HTTP resolution helpers
 * ------------------------------------------------------------------ */

export const matchRoute = internalQuery({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const routes = await ctx.db
      .query("routes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const active = routes.filter((route) => route.isActive);
    const path = normalizeStoragePath(args.path);
    const exact = active.find((route) => normalizeStoragePath(route.pathPattern) === path);
    if (exact) {
      return {
        id: exact._id,
        pathPattern: exact.pathPattern,
        targetFile: exact.targetFile ?? null,
        isProxy: exact.isProxy,
        proxyConfig: exact.proxyConfig ?? null,
        requiresAuth: exact.requiresAuth,
        requiredRole: exact.requiredRole ?? null,
      };
    }
    const wildcard = active.find((route) => route.pathPattern.includes("*") && matchRoutePattern(route.pathPattern, path));
    if (!wildcard) return null;
    return {
      id: wildcard._id,
      pathPattern: wildcard.pathPattern,
      targetFile: wildcard.targetFile ?? null,
      isProxy: wildcard.isProxy,
      proxyConfig: wildcard.proxyConfig ?? null,
      requiresAuth: wildcard.requiresAuth,
      requiredRole: wildcard.requiredRole ?? null,
      wildcard: true,
    };
  },
});

export const endpointConfig = internalQuery({
  args: { projectId: v.id("projects"), endpointName: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_project_endpoint", (q) =>
        q.eq("projectId", args.projectId).eq("endpointName", args.endpointName),
      )
      .unique();
    if (!row) return { isEnabled: true, requiresAuth: true, requiredRole: "Member" };
    return { isEnabled: row.isEnabled, requiresAuth: row.requiresAuth, requiredRole: row.requiredRole };
  },
});

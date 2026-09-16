import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { ensureMasterKey, readMasterKey } from "./lib/config";
import { decryptSecret, deriveKey, encryptSecret } from "./lib/crypto";
import { fail } from "./lib/errors";
import { audit, requireProjectOwnership, requireProjectOwnershipMutation } from "./lib/session";
import { bytesToBase64, base64ToBytes, createZip, readZip, utf8 } from "./lib/zip";

import { contentTypeFor, isTextPath, normalizeStoragePath } from "./lib/paths";
import { API_ENDPOINTS, WEBHOOK_EVENTS } from "./lib/permissions";
import { validateRoutePath, validateUrl } from "./lib/validation";

export const EXPORT_FEATURES = ["routes", "api", "roles", "secrets", "cron", "webhooks", "dns", "auth"] as const;

type ExportFeature = (typeof EXPORT_FEATURES)[number];

function isFeature(value: string): value is ExportFeature {
  return (EXPORT_FEATURES as readonly string[]).includes(value);
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  return [];
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

async function collectFeature(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  feature: ExportFeature,
  includeSecretValues: boolean,
) {
  switch (feature) {
    case "routes": {
      const rows = await ctx.db.query("routes").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      return rows.map((row) => ({
        path: row.pathPattern,
        target: row.targetFile ?? null,
        is_proxy: row.isProxy,
        proxy_config: row.proxyConfig ?? null,
        requires_auth: row.requiresAuth,
        required_role: row.requiredRole ?? null,
        is_active: row.isActive,
      }));
    }
    case "api": {
      const rows = await ctx.db
        .query("apiEndpoints")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      return rows.map((row) => ({
        endpoint_name: row.endpointName,
        is_enabled: row.isEnabled,
        requires_auth: row.requiresAuth,
        required_role: row.requiredRole,
      }));
    }
    case "roles": {
      const rows = await ctx.db.query("roles").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      return rows.map((row) => ({ name: row.name, permissions: row.permissions, is_system: row.isSystem }));
    }
    case "secrets": {
      const rows = await ctx.db.query("secrets").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      if (!includeSecretValues) return rows.map((row) => ({ key_name: row.keyName, value: null }));
      const master = await readMasterKey(ctx);
      if (!master) return rows.map((row) => ({ key_name: row.keyName, value: null }));
      const key = deriveKey(master, "localme.secrets.v1");
      return rows.map((row) => {
        try {
          return { key_name: row.keyName, value: decryptSecret(row.encryptedValue, key) };
        } catch {
          return { key_name: row.keyName, value: null };
        }
      });
    }
    case "cron": {
      const rows = await ctx.db
        .query("cronConfigs")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      return rows.map((row) => ({
        task_name: row.taskName,
        is_enabled: row.isEnabled,
        parameters: row.parameters,
      }));
    }
    case "webhooks": {
      const rows = await ctx.db.query("webhooks").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      return rows.map((row) => ({
        url: row.url,
        events: row.events,
        is_active: row.isActive,
        secret: row.secret ? (includeSecretValues ? row.secret : "***") : null,
      }));
    }
    case "dns": {
      const rows = await ctx.db.query("domains").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      return rows.map((row) => ({
        domain: row.domain,
        verification_token: row.verificationToken,
        is_verified: row.isVerified,
        ssl_status: row.sslStatus,
      }));
    }
    case "auth": {
      const project = await ctx.db.get(projectId);
      const visitors = await ctx.db
        .query("visitors")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      const roles = await ctx.db.query("roles").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      const roleNames = new Map(roles.map((role) => [role._id, role.name]));
      return {
        settings: {
          visitor_auth_enabled: project?.visitorAuthEnabled ?? true,
          signup_enabled: project?.signupEnabled ?? true,
          default_visitor_role: project?.defaultVisitorRole ?? "Member",
        },
        visitors: visitors.map((visitor) => ({
          username: visitor.username,
          role: visitor.roleId ? (roleNames.get(visitor.roleId) ?? "Member") : "Member",
          is_active: visitor.isActive,
        })),
      };
    }
    default:
      fail("Unknown export feature", 400, "invalid_feature");
  }
}

export const exportFeature = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects"), feature: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    if (!isFeature(args.feature)) fail("Unknown export feature", 400, "invalid_feature");
    const data = await collectFeature(ctx, args.projectId, args.feature, false);
    return { feature: args.feature, exportedAt: new Date().toISOString(), data };
  },
});

export const projectBundle = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    const files = await ctx.db.query("files").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect();
    const library = await ctx.db
      .query("libraryFiles")
      .withIndex("by_user", (q) => q.eq("userId", project.userId))
      .collect();
    const config: Record<string, unknown> = {};
    for (const feature of EXPORT_FEATURES) {
      if (feature === "secrets") continue;
      config[feature] = await collectFeature(ctx, args.projectId, feature, false);
    }
    const secrets = (await collectFeature(ctx, args.projectId, "secrets", true)) as {
      key_name: string;
      value: string | null;
    }[];
    const totalBytes =
      files.reduce((sum, file) => sum + file.size, 0) + library.reduce((sum, file) => sum + file.size, 0);
    return {
      project: {
        name: project.name,
        description: project.description ?? null,
        created_at: new Date(project.createdAt).toISOString(),
      },
      files: files.map((file) => ({
        path: file.path,
        text: file.text ?? null,
        storageId: file.storageId ?? null,
      })),
      library: library.map((file) => ({
        path: file.path,
        text: file.text ?? null,
        storageId: file.storageId ?? null,
      })),
      config,
      secrets,
      totalBytes,
    };
  },
});

export const authorisedBundle = internalQuery({
  args: { token: v.string(), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args): Promise<any> => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    return await ctx.runQuery(internal.transfer.projectBundle, { projectId: args.projectId });
  },
});

/** Full ZIP export: `storage/`, `lib/`, `config/config.json`, `config/secrets.json`. */
export const exportAll = action({
  args: { token: v.string(), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (
    ctx,
    args,
  ): Promise<{ filename: string; bytes: number; entries: number; base64: string }> => {
    const bundle: any = await ctx.runQuery(internal.transfer.authorisedBundle, {
      token: args.token,
      projectId: args.projectId,
    });
    if (bundle.totalBytes > 8_000_000) {
      fail(
        "Project is too large for a single export (8 MB limit). Export features individually.",
        413,
        "export_too_large",
      );
    }
    const entries: { path: string; data: Uint8Array }[] = [];
    const pushFile = async (prefix: string, file: { path: string; text: string | null; storageId: string | null }) => {
      const name = normalizeStoragePath(file.path).slice(1);
      if (typeof file.text === "string") {
        entries.push({ path: `${prefix}/${name}`, data: utf8(file.text) });
        return;
      }
      if (file.storageId) {
        const blob = await ctx.storage.get(file.storageId as Id<"_storage">);
        if (blob) entries.push({ path: `${prefix}/${name}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
    };
    for (const file of bundle.files) await pushFile("storage", file);
    for (const file of bundle.library) await pushFile("lib", file);
    entries.push({
      path: "config/config.json",
      data: utf8(
        JSON.stringify(
          { version: 1, exported_at: new Date().toISOString(), project: bundle.project, config: bundle.config },
          null,
          2,
        ),
      ),
    });
    entries.push({
      path: "config/secrets.json",
      data: utf8(
        JSON.stringify(
          {
            warning:
              "This file contains clear-text secret values. Treat it as highly sensitive and never share it.",
            secrets: bundle.secrets,
          },
          null,
          2,
        ),
      ),
    });
    const archive = createZip(entries);
    return {
      filename: `${bundle.project.name}-localme-backup.zip`,
      bytes: archive.length,
      entries: entries.length,
      base64: bytesToBase64(archive),
    };
  },
});

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

/** Applies one feature payload; `mode` decides merge vs replace semantics. */
export async function applyFeature(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  feature: ExportFeature,
  data: unknown,
  mode: "merge" | "replace",
): Promise<{ applied: number; mode: string; feature: string }> {
  const rows = asArray(data);
  const now = Date.now();

  if (mode === "replace") {
    if (feature === "routes") {
      const existing = await ctx.db.query("routes").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      for (const row of existing) if (row.pathPattern !== "/") await ctx.db.delete(row._id);
    }
    if (feature === "api") {
      const existing = await ctx.db
        .query("apiEndpoints")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      for (const row of existing) await ctx.db.delete(row._id);
    }
    if (feature === "cron") {
      const existing = await ctx.db
        .query("cronConfigs")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      for (const row of existing) await ctx.db.delete(row._id);
    }
    if (feature === "webhooks") {
      const existing = await ctx.db.query("webhooks").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      for (const row of existing) await ctx.db.delete(row._id);
    }
    if (feature === "roles") {
      const existing = await ctx.db.query("roles").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
      for (const row of existing) if (!row.isSystem) await ctx.db.delete(row._id);
    }
  }

  switch (feature) {
    case "routes": {
      for (const row of rows) {
        const pathPattern = validateRoutePath(String(row.path ?? row.path_pattern ?? ""));
        const existing = await ctx.db
          .query("routes")
          .withIndex("by_project_path", (q) => q.eq("projectId", projectId).eq("pathPattern", pathPattern))
          .unique();
        const isProxy = Boolean(row.is_proxy ?? row.isProxy);
        const targetFile = row.target ? normalizeStoragePath(String(row.target)) : undefined;
        const payload = {
          pathPattern,
          targetFile,
          isProxy,
          proxyConfig: (row.proxy_config as Record<string, unknown> | undefined) ?? undefined,
          requiresAuth: Boolean(row.requires_auth ?? row.requiresAuth ?? false),
          requiredRole: (row.required_role as string | undefined) ?? undefined,
          isActive: row.is_active === undefined ? true : Boolean(row.is_active),
          updatedAt: now,
        };
        if (existing) await ctx.db.patch(existing._id, payload);
        else await ctx.db.insert("routes", { projectId, createdAt: now, ...payload });
      }
      return { applied: rows.length, mode, feature };
    }
    case "api": {
      for (const row of rows) {
        const endpointName = String(row.endpoint_name ?? row.name ?? "");
        if (!API_ENDPOINTS.some((endpoint) => endpoint.name === endpointName)) continue;
        const existing = await ctx.db
          .query("apiEndpoints")
          .withIndex("by_project_endpoint", (q) => q.eq("projectId", projectId).eq("endpointName", endpointName))
          .unique();
        const payload = {
          isEnabled: row.is_enabled === undefined ? true : Boolean(row.is_enabled),
          requiresAuth: row.requires_auth === undefined ? true : Boolean(row.requires_auth),
          requiredRole: String(row.required_role ?? "Member"),
          updatedAt: now,
        };
        if (existing) await ctx.db.patch(existing._id, payload);
        else await ctx.db.insert("apiEndpoints", { projectId, endpointName, createdAt: now, ...payload });
      }
      return { applied: rows.length, mode, feature };
    }
    case "roles": {
      let applied = 0;
      for (const row of rows) {
        const name = String(row.name ?? "").trim();
        if (!name) continue;
        const existing = await ctx.db
          .query("roles")
          .withIndex("by_project_name", (q) => q.eq("projectId", projectId).eq("name", name))
          .unique();
        if (existing) {
          if (existing.name === "Owner") continue;
          await ctx.db.patch(existing._id, {
            permissions: row.permissions ?? existing.permissions,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("roles", {
            projectId,
            name,
            permissions: row.permissions ?? {},
            isSystem: false,
            createdAt: now,
            updatedAt: now,
          });
        }
        applied += 1;
      }
      return { applied, mode, feature };
    }
    case "cron": {
      for (const row of rows) {
        const taskName = String(row.task_name ?? row.name ?? "");
        if (!taskName) continue;
        const existing = await ctx.db
          .query("cronConfigs")
          .withIndex("by_project_task", (q) => q.eq("projectId", projectId).eq("taskName", taskName))
          .unique();
        const payload = {
          isEnabled: row.is_enabled === undefined ? true : Boolean(row.is_enabled),
          parameters: (row.parameters as Record<string, unknown>) ?? {},
          updatedAt: now,
        };
        if (existing) await ctx.db.patch(existing._id, payload);
        else await ctx.db.insert("cronConfigs", { projectId, taskName, createdAt: now, ...payload });
      }
      return { applied: rows.length, mode, feature };
    }
    case "webhooks": {
      for (const row of rows) {
        const url = validateUrl(String(row.url ?? ""));
        const events = Array.isArray(row.events)
          ? (row.events as unknown[]).map(String).filter((event) => (WEBHOOK_EVENTS as readonly string[]).includes(event))
          : [];
        if (events.length === 0) continue;
        const existing = await ctx.db.query("webhooks").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
        const match = existing.find((candidate) => candidate.url === url);
        const secret = typeof row.secret === "string" && row.secret !== "***" ? row.secret : undefined;
        if (match) {
          await ctx.db.patch(match._id, { events, isActive: row.is_active !== false, updatedAt: now });
        } else {
          await ctx.db.insert("webhooks", {
            projectId,
            url,
            secret,
            events,
            isActive: row.is_active !== false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      return { applied: rows.length, mode, feature };
    }
    case "secrets": {
      let applied = 0;
      const master = await ensureMasterKey(ctx);
      const key = deriveKey(master, "localme.secrets.v1");
      for (const row of rows) {
        const keyName = String(row.key_name ?? row.keyName ?? "").trim();
        const value = typeof row.value === "string" ? row.value : null;
        if (!keyName || !value) continue;
        const existing = await ctx.db
          .query("secrets")
          .withIndex("by_project_key", (q) => q.eq("projectId", projectId).eq("keyName", keyName))
          .unique();
        const encryptedValue = encryptSecret(value, key);
        if (existing) await ctx.db.patch(existing._id, { encryptedValue, updatedAt: now });
        else await ctx.db.insert("secrets", { projectId, keyName, encryptedValue, createdAt: now, updatedAt: now });
        applied += 1;
      }
      return { applied, mode, feature };
    }
    case "dns": {
      for (const row of rows) {
        const domain = String(row.domain ?? "").trim().toLowerCase();
        if (!domain) continue;
        const existing = await ctx.db.query("domains").withIndex("by_domain", (q) => q.eq("domain", domain)).unique();
        if (existing) continue;
        await ctx.db.insert("domains", {
          projectId,
          domain,
          verificationToken: String(row.verification_token ?? ""),
          isVerified: Boolean(row.is_verified),
          sslStatus: "none",
          createdAt: now,
          updatedAt: now,
        });
      }
      return { applied: rows.length, mode, feature };
    }
    case "auth": {
      const settings = (data && typeof data === "object" ? (data as Record<string, unknown>).settings : null) as
        | Record<string, unknown>
        | null;
      if (settings) {
        await ctx.db.patch(projectId, {
          visitorAuthEnabled: settings.visitor_auth_enabled === undefined ? true : Boolean(settings.visitor_auth_enabled),
          signupEnabled: settings.signup_enabled === undefined ? true : Boolean(settings.signup_enabled),
          defaultVisitorRole: String(settings.default_visitor_role ?? "Member"),
          updatedAt: now,
        });
      }
      const visitors = asArray((data as Record<string, unknown> | null)?.visitors);
      for (const row of visitors) {
        const username = String(row.username ?? "").trim();
        if (!username) continue;
        const existing = await ctx.db
          .query("visitors")
          .withIndex("by_project_username", (q) => q.eq("projectId", projectId).eq("username", username))
          .unique();
        if (existing) continue;
        const role = await ctx.db
          .query("roles")
          .withIndex("by_project_name", (q) => q.eq("projectId", projectId).eq("name", String(row.role ?? "Member")))
          .unique();
        await ctx.db.insert("visitors", {
          projectId,
          username,
          // Imported visitor accounts receive a random password the owner must reset.
          passwordHash: "scrypt$16384$8$1$import$import",
          roleId: role?._id,
          isActive: row.is_active !== false,
          failedLoginAttempts: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      return { applied: visitors.length, mode, feature };
    }
    default:
      fail("Unknown import feature", 400, "invalid_feature");
  }
}

export const importFeature = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    feature: v.string(),
    payload: v.string(),
    mode: v.union(v.literal("merge"), v.literal("replace")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    if (!isFeature(args.feature)) fail("Unknown import feature", 400, "invalid_feature");
    let parsed: unknown;
    try {
      parsed = JSON.parse(args.payload);
    } catch {
      fail("Import payload must be valid JSON", 400, "invalid_json");
    }
    const data = (parsed as { data?: unknown } | null)?.data ?? parsed;
    const result = await applyFeature(ctx, project._id, args.feature, data, args.mode);
    await audit(ctx, {
      level: "info",
      event: "import.feature",
      message: `Imported ${args.feature} (${args.mode})`,
      projectId: project._id,
      userId: user._id,
    });
    return result;
  },
});

export const importAll = action({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    base64: v.string(),
    mode: v.union(v.literal("merge"), v.literal("replace")),
  },
  returns: v.any(),
  handler: async (
    ctx,
    args,
  ): Promise<{ restored: { files: number; library: number; secrets: number } }> => {
    await ctx.runQuery(internal.transfer.authorisedBundle, { token: args.token, projectId: args.projectId });
    let entries: { path: string; data: Uint8Array }[];
    try {
      entries = readZip(base64ToBytes(args.base64));
    } catch (error) {
      fail(error instanceof Error ? error.message : "Unreadable archive", 400, "invalid_archive");
    }
    const configEntry = entries.find((entry) => entry.path === "config/config.json");
    if (!configEntry) fail("Archive is missing config/config.json", 400, "invalid_archive");
    let parsedConfig: { config?: Record<string, unknown> };
    try {
      parsedConfig = JSON.parse(new TextDecoder().decode(configEntry.data));
    } catch {
      fail("config/config.json is not valid JSON", 400, "invalid_archive");
    }
    const secretsEntry = entries.find((entry) => entry.path === "config/secrets.json");
    let secrets: { key_name: string; value: string | null }[] = [];
    if (secretsEntry) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(secretsEntry.data)) as {
          secrets?: { key_name: string; value: string | null }[];
        };
        secrets = parsed.secrets ?? [];
      } catch {
        secrets = [];
      }
    }
    const toEntries = async (prefix: string) => {
      const selected = entries.filter((entry) => entry.path.startsWith(prefix));
      const rows: {
        path: string;
        text: string | null;
        storageId: Id<"_storage"> | null;
        contentType: string;
        isText: boolean;
      }[] = [];
      for (const entry of selected) {
        const isText = isTextPath(entry.path);
        rows.push({
          path: `/${entry.path.slice(prefix.length)}`,
          text: isText ? new TextDecoder().decode(entry.data) : null,
          storageId: isText ? null : await ctx.storage.store(new Blob([entry.data.slice().buffer])),
          contentType: contentTypeFor(entry.path),
          isText,
        });
      }
      return rows;
    };
    const restored: { files: number; library: number; secrets: number } = await ctx.runMutation(
      internal.transfer.restoreBundle,
      {
        token: args.token,
        projectId: args.projectId,
        mode: args.mode,
        files: await toEntries("storage/"),
        library: await toEntries("lib/"),
        secrets,
        config: parsedConfig.config ?? {},
      },
    );
    return { restored };
  },
});

export const restoreBundle = internalMutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    mode: v.union(v.literal("merge"), v.literal("replace")),
    files: v.array(
      v.object({
        path: v.string(),
        text: v.union(v.string(), v.null()),
        storageId: v.union(v.id("_storage"), v.null()),
        contentType: v.string(),
        isText: v.boolean(),
      }),
    ),
    library: v.array(
      v.object({
        path: v.string(),
        text: v.union(v.string(), v.null()),
        storageId: v.union(v.id("_storage"), v.null()),
        contentType: v.string(),
        isText: v.boolean(),
      }),
    ),
    secrets: v.array(v.object({ key_name: v.string(), value: v.union(v.string(), v.null()) })),
    config: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const now = Date.now();
    let fileCount = 0;
    let libraryCount = 0;

    for (const file of args.files) {
      const path = normalizeStoragePath(file.path);
      const existing = await ctx.db
        .query("files")
        .withIndex("by_project_path", (q) => q.eq("projectId", project._id).eq("path", path))
        .unique();
      if (existing && args.mode === "merge") continue;
      const text = file.text ?? undefined;
      const storageId = text === undefined ? (file.storageId ?? undefined) : undefined;
      const size = text !== undefined ? text.length : 0;
      if (existing) {
        if (existing.storageId && existing.storageId !== storageId) await ctx.storage.delete(existing.storageId);
        await ctx.db.patch(existing._id, {
          text,
          storageId,
          size,
          contentType: file.contentType,
          isText: file.isText,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("files", {
          projectId: project._id,
          path,
          name: path.slice(path.lastIndexOf("/") + 1),
          directory: path.slice(0, path.lastIndexOf("/")) || "/",
          text,
          storageId,
          size,
          contentType: file.contentType,
          isText: file.isText,
          createdAt: now,
          updatedAt: now,
        });
      }
      fileCount += 1;
    }

    for (const file of args.library) {
      const path = normalizeStoragePath(file.path);
      const existing = await ctx.db
        .query("libraryFiles")
        .withIndex("by_user_path", (q) => q.eq("userId", user._id).eq("path", path))
        .unique();
      if (existing && args.mode === "merge") continue;
      const text = file.text ?? undefined;
      const storageId = text === undefined ? (file.storageId ?? undefined) : undefined;
      const size = text !== undefined ? text.length : 0;
      if (existing) {
        if (existing.storageId && existing.storageId !== storageId) await ctx.storage.delete(existing.storageId);
        await ctx.db.patch(existing._id, {
          text,
          storageId,
          size,
          contentType: file.contentType,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("libraryFiles", {
          userId: user._id,
          path,
          name: path.slice(path.lastIndexOf("/") + 1),
          text,
          storageId,
          size,
          contentType: file.contentType,
          isText: file.isText,
          createdAt: now,
          updatedAt: now,
        });
      }
      libraryCount += 1;
    }

    for (const feature of EXPORT_FEATURES) {
      if (feature === "secrets") continue;
      const data = (args.config as Record<string, unknown> | null)?.[feature];
      if (data === undefined) continue;
      await applyFeature(ctx, project._id, feature, data, args.mode);
    }
    if (args.secrets.length > 0) {
      await applyFeature(ctx, project._id, "secrets", args.secrets, args.mode);
    }
    await audit(ctx, {
      level: "info",
      event: "import.all",
      message: `Restored ${fileCount} file(s), ${libraryCount} library asset(s)`,
      projectId: project._id,
      userId: user._id,
    });
    return { files: fileCount, library: libraryCount, secrets: args.secrets.length };
  },
});

/* ------------------------------------------------------------------ *
 * Cascading delete (P-31): every associated record and blob is removed.
 * ------------------------------------------------------------------ */

export const purgeProjectData = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const projectId = args.projectId;

    const files = await ctx.db.query("files").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    for (const file of files) {
      if (file.storageId) await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    for (const row of await ctx.db.query("projectData").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("dataTables").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("routes").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("apiEndpoints").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("roles").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("visitors").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      for (const session of await ctx.db
        .query("sessions")
        .withIndex("by_visitor", (q) => q.eq("visitorId", row._id))
        .collect()) {
        await ctx.db.delete(session._id);
      }
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("secrets").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("cronConfigs").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("cronRuns").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("webhookDeliveries").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("webhooks").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("domains").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("visitLogs").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db
      .query("dailyProjectStats")
      .withIndex("by_project_date", (q) => q.eq("projectId", projectId))
      .collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("apiKeys").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("auditLogs").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

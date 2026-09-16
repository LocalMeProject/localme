import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { ensureMasterKey, readMasterKey } from "./lib/config";
import { decryptSecret, deriveKey, encryptSecret } from "./lib/crypto";
import { fail } from "./lib/errors";
import { assertPermission, principalValidator } from "./lib/principal";
import { audit, requireProjectOwnership, requireProjectOwnershipMutation } from "./lib/session";

const KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

function validateKeyName(name: unknown): string {
  const value = String(name ?? "").trim();
  if (!KEY_PATTERN.test(value)) {
    fail("Secret keys must be SCREAMING_SNAKE_CASE, 2-64 characters", 400, "invalid_key");
  }
  return value;
}

async function encryptionKey(ctx: QueryCtx) {
  const master = await readMasterKey(ctx);
  if (!master) fail("Secret store is not initialised yet", 409, "not_initialised");
  return deriveKey(master, "localme.secrets.v1");
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export const list = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const secrets = await ctx.db
      .query("secrets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return secrets
      .map((secret) => ({
        id: secret._id,
        keyName: secret.keyName,
        preview: "••••••••",
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
      }))
      .sort((a, b) => a.keyName.localeCompare(b.keyName));
  },
});

export const set = mutation({
  args: { token: v.string(), projectId: v.id("projects"), keyName: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const keyName = validateKeyName(args.keyName);
    if (!args.value) fail("Secret values cannot be empty", 400, "invalid_value");
    const master = await ensureMasterKey(ctx);
    const encryptedValue = encryptSecret(args.value, deriveKey(master, "localme.secrets.v1"));
    const existing = await ctx.db
      .query("secrets")
      .withIndex("by_project_key", (q) => q.eq("projectId", project._id).eq("keyName", keyName))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { encryptedValue, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("secrets", {
        projectId: project._id,
        keyName,
        encryptedValue,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    await audit(ctx, {
      level: "info",
      event: "secret.set",
      message: `Secret ${keyName} stored`,
      projectId: project._id,
      userId: user._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), projectId: v.id("projects"), keyName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const existing = await ctx.db
      .query("secrets")
      .withIndex("by_project_key", (q) => q.eq("projectId", project._id).eq("keyName", args.keyName))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Reveals a secret to the project owner only, for wiring up a proxy route. */
export const reveal = mutation({
  args: { token: v.string(), projectId: v.id("projects"), keyName: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, project, isOwner } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    if (!isOwner && user.role !== "admin") fail("Only the project owner can reveal secret values", 403, "forbidden");
    const row = await ctx.db
      .query("secrets")
      .withIndex("by_project_key", (q) => q.eq("projectId", project._id).eq("keyName", args.keyName))
      .unique();
    if (!row) fail("Secret not found", 404, "not_found");
    const key = await encryptionKey(ctx);
    await audit(ctx, {
      level: "warning",
      event: "secret.reveal",
      message: `Secret ${args.keyName} revealed to ${user.username}`,
      projectId: project._id,
      userId: user._id,
    });
    return { keyName: row.keyName, value: decryptSecret(row.encryptedValue, key) };
  },
});

/* ------------------------------------------------------------------ *
 * HTTP API
 * ------------------------------------------------------------------ */

export const apiGetSecret = internalQuery({
  args: { projectId: v.id("projects"), principal: principalValidator, key: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    assertPermission(args.principal, "secrets_admin");
    const keyName = validateKeyName(args.key);
    const row = await ctx.db
      .query("secrets")
      .withIndex("by_project_key", (q) => q.eq("projectId", args.projectId).eq("keyName", keyName))
      .unique();
    if (!row) fail("Secret not found", 404, "not_found");
    const key = await encryptionKey(ctx);
    return { key: row.keyName, value: decryptSecret(row.encryptedValue, key) };
  },
});

/**
 * Decrypts project secrets for server-side use only (proxy header
 * substitution). Values never leave the deployment (P-11).
 */
export const proxySecrets = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("secrets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    if (rows.length === 0) return {};
    const key = await encryptionKey(ctx);
    const out: Record<string, string> = {};
    for (const row of rows) {
      try {
        out[row.keyName] = decryptSecret(row.encryptedValue, key);
      } catch {
        /* skip unreadable secrets rather than failing the proxy request */
      }
    }
    return out;
  },
});

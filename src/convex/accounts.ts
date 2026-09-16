import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ensureConfigs, readConfig } from "./lib/config";
import { hashPassword, randomId, verifyPassword } from "./lib/crypto";
import { fail } from "./lib/errors";
import { libraryStorageUsed, storageCaps, userStorageUsed } from "./lib/files";
import { permissionsForRole } from "./lib/permissions";
import {
  audit,
  createPlatformSession,
  destroySession,
  readPlatformUser,
  requireAdmin,
  touchPlatformUser,
} from "./lib/session";
import { validateEmail, validatePassword, validateUsername } from "./lib/validation";

export type PublicUser = {
  id: Id<"users">;
  username: string;
  email?: string;
  role: "admin" | "operator" | "user";
  storageCapBytes: number;
  isSuspended: boolean;
  createdAt: number;
  lastLoginAt?: number;
};

function toPublicUser(user: Doc<"users">): PublicUser {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    storageCapBytes: user.storageCapBytes,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

async function authSettings(ctx: QueryCtx | MutationCtx) {
  return readConfig<{ max_login_attempts: number; lockout_minutes: number; api_key_expiry_days: number }>(
    ctx,
    "auth",
  );
}

/* ------------------------------------------------------------------ *
 * CAPTCHA (math challenge, rendered client-side or as SVG by /auth/captcha)
 * ------------------------------------------------------------------ */

export async function issueCaptcha(ctx: MutationCtx): Promise<{ captchaId: string; question: string; answer: number }> {
  const left = 2 + Math.floor(Math.random() * 8);
  const right = 1 + Math.floor(Math.random() * 9);
  const operators = ["+", "-"] as const;
  const operator = operators[Math.floor(Math.random() * operators.length)];
  const answer = operator === "+" ? left + right : Math.max(left, right) - Math.min(left, right);
  const question =
    operator === "+" ? `${left} + ${right}` : `${Math.max(left, right)} − ${Math.min(left, right)}`;
  const captchaId = randomId("cap");
  await ctx.db.insert("captchas", {
    captchaId,
    answer: String(answer),
    expiresAt: Date.now() + 5 * 60 * 1000,
    createdAt: Date.now(),
  });
  return { captchaId, question, answer };
}

async function consumeCaptcha(ctx: MutationCtx, captchaId: string | undefined, answer: string | undefined) {
  if (!captchaId || answer === undefined) fail("Solve the CAPTCHA to continue", 400, "captcha_required");
  const row = await ctx.db
    .query("captchas")
    .withIndex("by_captcha_id", (q) => q.eq("captchaId", captchaId))
    .unique();
  if (!row) fail("CAPTCHA expired. Request a new one.", 400, "captcha_expired");
  if (row.expiresAt < Date.now()) {
    await ctx.db.delete(row._id);
    fail("CAPTCHA expired. Request a new one.", 400, "captcha_expired");
  }
  await ctx.db.delete(row._id);
  if (row.answer !== String(answer).trim()) fail("Incorrect CAPTCHA answer", 400, "captcha_incorrect");
}

export const createCaptcha = mutation({
  args: {},
  returns: v.object({ captchaId: v.string(), question: v.string() }),
  handler: async (ctx) => {
    const { captchaId, question } = await issueCaptcha(ctx);
    return { captchaId, question };
  },
});

/* ------------------------------------------------------------------ *
 * Signup / login / logout
 * ------------------------------------------------------------------ */

export const signup = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    email: v.optional(v.string()),
    captchaId: v.optional(v.string()),
    captchaAnswer: v.optional(v.string()),
    ip: v.optional(v.string()),
  },
  returns: v.object({ token: v.string(), user: v.any() }),
  handler: async (ctx, args) => {
    await ensureConfigs(ctx);
    const platform = await readConfig<{ allow_public_signup: boolean }>(ctx, "platform");
    if (!platform.allow_public_signup) {
      fail("Public signup is disabled on this deployment", 403, "signup_disabled");
    }
    const username = validateUsername(args.username);
    const password = validatePassword(args.password);
    const email = validateEmail(args.email);
    await consumeCaptcha(ctx, args.captchaId, args.captchaAnswer);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) fail("That username is already taken", 409, "username_taken");

    const storage = await readConfig<{ default_user_cap_bytes: number }>(ctx, "storage");
    const existingUsers = await ctx.db.query("users").collect();
    const isFirstAccount = existingUsers.length === 0;
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      username,
      email,
      passwordHash: await hashPassword(password),
      role: isFirstAccount ? "admin" : "user",
      storageCapBytes: storage.default_user_cap_bytes,
      isSuspended: false,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });
    const { token } = await createPlatformSession(ctx, userId, { ip: args.ip });
    const user = (await ctx.db.get(userId))!;
    await audit(ctx, {
      level: "info",
      event: "user.signup",
      message: `Account created for ${username}`,
      userId,
      context: { firstAccount: isFirstAccount },
    });
    return { token, user: toPublicUser(user) };
  },
});

export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    captchaId: v.optional(v.string()),
    captchaAnswer: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ token: v.string(), user: v.any() }),
  handler: async (ctx, args) => {
    await ensureConfigs(ctx);
    const settings = await authSettings(ctx);
    const username = String(args.username ?? "").trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!user) fail("Invalid username or password", 401, "invalid_credentials");
    if (user.isSuspended) fail("This account is suspended", 403, "account_suspended");
    if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
      const seconds = Math.ceil((user.lockoutUntil - Date.now()) / 1000);
      fail(`Too many failed attempts. Try again in ${seconds} seconds.`, 429, "locked_out");
    }
    await consumeCaptcha(ctx, args.captchaId, args.captchaAnswer);
    const valid = await verifyPassword(args.password ?? "", user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const locked = attempts >= settings.max_login_attempts;
      await ctx.db.patch(user._id, {
        failedLoginAttempts: locked ? 0 : attempts,
        lockoutUntil: locked ? Date.now() + settings.lockout_minutes * 60 * 1000 : undefined,
        updatedAt: Date.now(),
      });
      if (locked) {
        await audit(ctx, {
          level: "warning",
          event: "user.lockout",
          message: `Account ${username} locked after ${attempts} failed attempts`,
          userId: user._id,
        });
      }
      fail("Invalid username or password", 401, "invalid_credentials");
    }
    await ctx.db.patch(user._id, {
      failedLoginAttempts: 0,
      lockoutUntil: undefined,
      lastLoginAt: Date.now(),
      updatedAt: Date.now(),
    });
    const { token } = await createPlatformSession(ctx, user._id, { ip: args.ip, userAgent: args.userAgent });
    const refreshed = (await ctx.db.get(user._id))!;
    await audit(ctx, {
      level: "info",
      event: "user.login",
      message: `${username} signed in`,
      userId: user._id,
    });
    return { token, user: toPublicUser(refreshed) };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await destroySession(ctx, args.token);
    return null;
  },
});

export const me = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) return null;
    return toPublicUser(user);
  },
});

/** Full dashboard header payload: profile, storage usage and project count. */
export const overview = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) return null;
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const caps = await storageCaps(ctx, user);
    const libraryUsed = await libraryStorageUsed(ctx, user._id);
    return {
      user: toPublicUser(user),
      storage: { used: caps.used, cap: caps.cap, libraryBonus: caps.libraryBonus, maxUpload: caps.maxUpload },
      libraryUsed,
      projectCount: projects.length,
      activeProjectCount: projects.filter((project) => project.isActive).length,
      rolePermissions: permissionsForRole("Owner"),
    };
  },
});

export const updateProfile = mutation({
  args: {
    token: v.string(),
    email: v.optional(v.string()),
    newPassword: v.optional(v.string()),
    currentPassword: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await touchPlatformUser(ctx, args.token);
    if (!user) fail("Authentication required", 401, "unauthenticated");
    const patch: Partial<Doc<"users">> = { updatedAt: Date.now() };
    if (args.email !== undefined) patch.email = validateEmail(args.email);
    if (args.username !== undefined && args.username !== user.username) {
      const username = validateUsername(args.username);
      const taken = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique();
      if (taken) fail("That username is already taken", 409, "username_taken");
      patch.username = username;
    }
    if (args.newPassword !== undefined) {
      const currentPassword = args.currentPassword ?? "";
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) fail("Current password is incorrect", 403, "invalid_credentials");
      patch.passwordHash = await hashPassword(validatePassword(args.newPassword));
    }
    await ctx.db.patch(user._id, patch);
    return toPublicUser((await ctx.db.get(user._id))!);
  },
});

/** Lists a user's active sessions so they can review or revoke them. */
export const sessions = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) return [];
    const rows = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .filter((row) => row.kind === "platform" && row.expiresAt > Date.now())
      .map((row) => ({
        id: row._id,
        createdAt: row.createdAt,
        lastAccessedAt: row.lastAccessedAt,
        expiresAt: row.expiresAt,
        ip: row.ip,
        userAgent: row.userAgent,
        current: row.token === args.token,
      }));
  },
});

/* ------------------------------------------------------------------ *
 * Admin: user management
 * ------------------------------------------------------------------ */

export const adminListUsers = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const users = await ctx.db.query("users").collect();
    const rows = [];
    for (const user of users) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      rows.push({
        ...toPublicUser(user),
        projectCount: projects.length,
        storageUsed: await userStorageUsed(ctx, user._id),
      });
    }
    return rows.sort((a, b) => a.username.localeCompare(b.username));
  },
});

export const adminSetUserRole = mutation({
  args: { token: v.string(), userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("operator"), v.literal("user")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token);
    if (admin._id === args.userId && args.role !== "admin") {
      fail("You cannot remove your own administrator access", 400, "invalid_operation");
    }
    await ctx.db.patch(args.userId, { role: args.role, updatedAt: Date.now() });
    await audit(ctx, {
      level: "info",
      event: "admin.user.role",
      message: `Role for user ${args.userId} set to ${args.role}`,
      userId: admin._id,
    });
    return null;
  },
});

export const adminSetUserSuspended = mutation({
  args: { token: v.string(), userId: v.id("users"), isSuspended: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token);
    if (admin._id === args.userId && args.isSuspended) fail("You cannot suspend your own account", 400, "invalid_operation");
    await ctx.db.patch(args.userId, { isSuspended: args.isSuspended, updatedAt: Date.now() });
    return null;
  },
});

export const adminSetStorageCap = mutation({
  args: { token: v.string(), userId: v.id("users"), storageCapBytes: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const storage = await readConfig<{ max_user_cap_bytes: number }>(ctx, "storage");
    if (args.storageCapBytes < 0 || args.storageCapBytes > storage.max_user_cap_bytes) {
      fail("Storage cap is outside the allowed range", 400, "invalid_cap");
    }
    await ctx.db.patch(args.userId, { storageCapBytes: args.storageCapBytes, updatedAt: Date.now() });
    return null;
  },
});

export const adminDeleteUser = mutation({
  args: { token: v.string(), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token);
    if (admin._id === args.userId) fail("You cannot delete your own account", 400, "invalid_operation");
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const project of projects) {
      await ctx.scheduler.runAfter(0, internal.transfer.purgeProjectData, { projectId: project._id });
    }
    const library = await ctx.db
      .query("libraryFiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const file of library) {
      if (file.storageId) await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(args.userId);
    await audit(ctx, {
      level: "warning",
      event: "admin.user.delete",
      message: `Deleted account ${user.username} with ${projects.length} project(s)`,
      userId: admin._id,
    });
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * Platform activity feed (admin)
 * ------------------------------------------------------------------ */

export const adminAuditLog = query({
  args: { token: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(args.limit ?? 100, 200));
    return rows;
  },
});

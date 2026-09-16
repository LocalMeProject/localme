import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hashPassword, randomToken, verifyPassword } from "./crypto";
import { fail } from "./errors";
import { ALL_PERMISSIONS, type Permission } from "./permissions";

export const SESSION_COOKIE = "mvp_session";
export const CAPTCHA_COOKIE = "mvp_captcha";
export const VISITOR_COOKIE_PREFIX = "auth_";

export type AnyCtx = QueryCtx | MutationCtx;
export type SessionRow = Doc<"sessions">;
export type UserRow = Doc<"users">;
export type ProjectRow = Doc<"projects">;

/* ------------------------------------------------------------------ *
 * Cookies & headers
 * ------------------------------------------------------------------ */

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) return jar;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) jar[key] = decodeURIComponent(value);
  }
  return jar;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; path?: string; httpOnly?: boolean; sameSite?: "Lax" | "Strict" | "None"; secure?: boolean } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "0.0.0.0";
}

export function isAdmin(user: UserRow | null | undefined): boolean {
  return user?.role === "admin";
}

/* ------------------------------------------------------------------ *
 * Platform sessions (P-19 sliding 20 minute expiry)
 * ------------------------------------------------------------------ */

export async function sessionTimeoutMs(ctx: AnyCtx): Promise<number> {
  const config = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("configKey", "auth"))
    .unique();
  const minutes = (config?.configValue as { session_timeout_minutes?: number } | undefined)?.session_timeout_minutes;
  return (minutes ?? 20) * 60 * 1000;
}

export async function createPlatformSession(
  ctx: MutationCtx,
  userId: Id<"users">,
  meta: { ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: number }> {
  const ttl = await sessionTimeoutMs(ctx);
  const token = randomToken(32);
  const now = Date.now();
  await ctx.db.insert("sessions", {
    token,
    kind: "platform",
    userId,
    data: {},
    ip: meta.ip,
    userAgent: meta.userAgent,
    createdAt: now,
    expiresAt: now + ttl,
    lastAccessedAt: now,
  });
  return { token, expiresAt: now + ttl };
}

export async function findSession(ctx: AnyCtx, token: string): Promise<SessionRow | null> {
  if (!token) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

/** Read-only session lookup for reactive queries. */
export async function readPlatformUser(ctx: AnyCtx, token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const session = await findSession(ctx, token);
  if (!session || session.kind !== "platform" || !session.userId) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.isSuspended) return null;
  return user;
}

/** Mutation variant that extends the sliding expiry (P-19). */
export async function touchPlatformUser(ctx: MutationCtx, token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const session = await findSession(ctx, token);
  if (!session || session.kind !== "platform" || !session.userId) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.isSuspended) return null;
  const ttl = await sessionTimeoutMs(ctx);
  await ctx.db.patch(session._id, { expiresAt: Date.now() + ttl, lastAccessedAt: Date.now() });
  return user;
}

export async function requireUser(ctx: AnyCtx, token: string | undefined): Promise<UserRow> {
  const user = await readPlatformUser(ctx, token);
  if (!user) fail("Authentication required", 401, "unauthenticated");
  return user;
}

export async function requireAdmin(ctx: AnyCtx, token: string | undefined): Promise<UserRow> {
  const user = await requireUser(ctx, token);
  if (user.role !== "admin") fail("Administrator privileges required", 403, "forbidden");
  return user;
}

/** Operators have read-only visibility across all accounts (Blueprint §5.5). */
export async function requireOperator(ctx: AnyCtx, token: string | undefined): Promise<UserRow> {
  const user = await requireUser(ctx, token);
  if (user.role !== "admin" && user.role !== "operator") {
    fail("Operator privileges required", 403, "forbidden");
  }
  return user;
}

export async function destroySession(ctx: MutationCtx, token: string | undefined): Promise<void> {
  if (!token) return;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (session) await ctx.db.delete(session._id);
}

/* ------------------------------------------------------------------ *
 * Projects & authorization
 * ------------------------------------------------------------------ */

export type ProjectAccess = {
  user: UserRow;
  project: ProjectRow;
  isOwner: boolean;
  roleName: string;
};

async function projectAccess(ctx: AnyCtx, user: UserRow, projectId: Id<"projects">): Promise<ProjectAccess> {
  const project = await ctx.db.get(projectId);
  if (!project) fail("Project not found", 404, "not_found");
  const isOwner = project.userId === user._id;
  if (!isOwner && user.role !== "admin") {
    fail("You do not have access to this project", 403, "forbidden");
  }
  return { user, project, isOwner, roleName: isOwner ? "Owner" : "Admin" };
}

/** Read-only ownership check (safe inside queries). */
export async function requireProjectOwnership(
  ctx: AnyCtx,
  token: string | undefined,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const user = await requireUser(ctx, token);
  return projectAccess(ctx, user, projectId);
}

/** Mutation ownership check that also extends the sliding session expiry. */
export async function requireProjectOwnershipMutation(
  ctx: MutationCtx,
  token: string | undefined,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const user = await touchPlatformUser(ctx, token);
  if (!user) fail("Authentication required", 401, "unauthenticated");
  return projectAccess(ctx, user, projectId);
}

/** Mutation authentication helper that extends the sliding session expiry. */
export async function requireUserMutation(ctx: MutationCtx, token: string | undefined): Promise<UserRow> {
  const user = await touchPlatformUser(ctx, token);
  if (!user) fail("Authentication required", 401, "unauthenticated");
  return user;
}

export async function findProjectByOwnerName(ctx: AnyCtx, username: string, projectName: string) {
  const owner = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();
  if (!owner) return null;
  const project = await ctx.db
    .query("projects")
    .withIndex("by_user_name", (q) => q.eq("userId", owner._id).eq("name", projectName))
    .unique();
  if (!project) return null;
  return { owner, project };
}

/* ------------------------------------------------------------------ *
 * Visitor sessions (P-17 per-project scope)
 * ------------------------------------------------------------------ */

export type VisitorAccess = {
  visitor: Doc<"visitors"> | null;
  roleName: string;
  permissions: Record<string, boolean>;
};

export async function resolveVisitor(
  ctx: AnyCtx,
  token: string | undefined,
  projectId: Id<"projects">,
): Promise<VisitorAccess | null> {
  if (!token) return null;
  const session = await findSession(ctx, token);
  if (!session || session.kind !== "visitor" || !session.visitorId) return null;
  if (session.projectId !== projectId) return null;
  const visitor = await ctx.db.get(session.visitorId);
  if (!visitor || !visitor.isActive || visitor.projectId !== projectId) return null;
  const role = visitor.roleId ? await ctx.db.get(visitor.roleId) : null;
  return {
    visitor,
    roleName: role?.name ?? "Guest",
    permissions: (role?.permissions as Record<string, boolean> | undefined) ?? {},
  };
}

export function assertPermission(
  access: { permissions: Record<string, boolean> } | null,
  permission: Permission,
): void {
  if (!access?.permissions?.[permission]) {
    fail(`Missing permission: ${permission}`, 403, "forbidden");
  }
}

export function permissionSummary(permissions: Record<string, boolean>): string[] {
  return ALL_PERMISSIONS.filter((permission) => permissions[permission]);
}

/* ------------------------------------------------------------------ *
 * API keys — storage/library only (P-12)
 * ------------------------------------------------------------------ */

export const API_KEY_SCOPES: Permission[] = ["storage_read", "storage_write", "lib_read", "lib_write"];

export async function createApiKeyRecord(
  ctx: MutationCtx,
  args: { projectId: Id<"projects">; userId: Id<"users">; name: string; roleName: string; expiryDays: number },
): Promise<{ rawKey: string; prefix: string }> {
  const rawKey = `sk_${randomToken(24)}`;
  const keyHash = await hashPassword(rawKey);
  const now = Date.now();
  await ctx.db.insert("apiKeys", {
    projectId: args.projectId,
    userId: args.userId,
    name: args.name,
    roleName: args.roleName,
    keyHash,
    keyPrefix: rawKey.slice(0, 11),
    isActive: true,
    expiresAt: now + args.expiryDays * 24 * 60 * 60 * 1000,
    createdAt: now,
  });
  return { rawKey, prefix: rawKey.slice(0, 11) };
}

export type ApiKeyContext = { apiKey: Doc<"apiKeys">; project: ProjectRow };

export async function resolveApiKey(ctx: AnyCtx, rawKey: string): Promise<ApiKeyContext | null> {
  if (!rawKey) return null;
  const prefix = rawKey.slice(0, 11);
  const candidates = await ctx.db
    .query("apiKeys")
    .filter((q) => q.eq(q.field("keyPrefix"), prefix))
    .collect();
  for (const candidate of candidates) {
    if (!candidate.isActive) continue;
    if (candidate.expiresAt < Date.now()) continue;
    if (await verifyPassword(rawKey, candidate.keyHash)) {
      const project = await ctx.db.get(candidate.projectId);
      if (!project) return null;
      return { apiKey: candidate, project };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Rate limiting (P-16 sliding window, database backed)
 * ------------------------------------------------------------------ */

export type RateLimitResult = { allowed: boolean; count: number; limit: number; retryAfterSeconds: number };

export async function checkRateLimit(
  ctx: MutationCtx,
  args: { identity: string; routePattern: string; limit: number; windowMs?: number; cost?: number },
): Promise<RateLimitResult> {
  const windowMs = args.windowMs ?? 60_000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const bucketKey = `${args.identity}:${args.routePattern}`;
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_bucket", (q) => q.eq("bucketKey", bucketKey).eq("windowStart", windowStart))
    .unique();
  const cost = args.cost ?? 1;
  const count = (existing?.requestCount ?? 0) + cost;
  if (existing) {
    await ctx.db.patch(existing._id, { requestCount: count });
  } else {
    await ctx.db.insert("rateLimits", {
      bucketKey,
      identityKey: args.identity,
      routePattern: args.routePattern,
      windowStart,
      requestCount: cost,
    });
  }
  return {
    allowed: count <= args.limit,
    count,
    limit: args.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
  };
}

/* ------------------------------------------------------------------ *
 * Audit log
 * ------------------------------------------------------------------ */

export async function audit(
  ctx: MutationCtx,
  entry: {
    level: "info" | "warning" | "error";
    event: string;
    message: string;
    projectId?: Id<"projects">;
    userId?: Id<"users">;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    level: entry.level,
    event: entry.event,
    message: entry.message,
    projectId: entry.projectId,
    userId: entry.userId,
    context: entry.context ?? {},
    createdAt: Date.now(),
  });
}

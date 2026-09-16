import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ensureMasterKey, ensureSigningSecret, readConfig, readSigningSecret } from "./lib/config";
import { hashPassword, randomId, signJwt, verifyJwt, verifyPassword } from "./lib/crypto";
import { fail } from "./lib/errors";
import { ALL_PERMISSIONS, type Permission } from "./lib/permissions";
import { ANONYMOUS, API_KEY_PERMISSIONS, type Principal } from "./lib/principal";
import {
  audit,
  findProjectByOwnerName,
  findSession,
  resolveApiKey,
  sessionTimeoutMs,
  VISITOR_COOKIE_PREFIX,
} from "./lib/session";
import { validatePassword, validateVisitorUsername } from "./lib/validation";
import { emitEvent } from "./lib/webhookBus";

export const visitorCookieName = (projectId: string) => `${VISITOR_COOKIE_PREFIX}${projectId}`;

/* ------------------------------------------------------------------ *
 * Project lookup
 * ------------------------------------------------------------------ */

export const projectBySlug = internalQuery({
  args: { username: v.string(), name: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const found = await findProjectByOwnerName(ctx, args.username, args.name);
    if (!found) return null;
    return {
      projectId: found.project._id,
      ownerId: found.owner._id,
      ownerUsername: found.owner.username,
      ownerSuspended: found.owner.isSuspended,
      name: found.project.name,
      isActive: found.project.isActive,
      visitorAuthEnabled: found.project.visitorAuthEnabled,
      signupEnabled: found.project.signupEnabled,
      defaultVisitorRole: found.project.defaultVisitorRole,
      watermarkEnabled: found.project.watermarkEnabled,
      visitsUsedThisMonth: found.project.visitsUsedThisMonth,
      freeVisitsPerMonth: found.project.freeVisitsPerMonth,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Principal resolution
 * ------------------------------------------------------------------ */

async function visitorPrincipal(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  visitorToken: string | undefined,
): Promise<{ principal: Principal; sessionId?: string } | null> {
  if (!visitorToken) return null;
  const secret = await readSigningSecret(ctx);
  if (!secret) return null;
  const claims = verifyJwt(visitorToken, secret);
  if (!claims) return null;
  const sid = typeof claims.sid === "string" ? claims.sid : undefined;
  if (!sid) return null;
  const session = await findSession(ctx, sid);
  if (!session || session.kind !== "visitor" || !session.visitorId) return null;
  if (session.projectId !== projectId) return null;
  const visitor = await ctx.db.get(session.visitorId);
  if (!visitor || !visitor.isActive) return null;
  const role = visitor.roleId ? await ctx.db.get(visitor.roleId) : null;
  const permissions = Object.entries((role?.permissions as Record<string, boolean> | undefined) ?? {})
    .filter(([, granted]) => granted)
    .map(([name]) => name);
  return {
    principal: {
      kind: "visitor",
      permissions,
      roleName: role?.name ?? "Guest",
      username: visitor.username,
      visitorId: visitor._id,
      userId: undefined,
      sessionId: sid,
      ip: session.ip,
    },
    sessionId: sid,
  };
}

/**
 * Resolves the effective principal for a project request.
 *
 * Precedence: platform owner session → API key → visitor session → anonymous.
 * Any matched session has its sliding expiry extended (P-19).
 */
export const resolvePrincipal = internalMutation({
  args: {
    projectId: v.id("projects"),
    apiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    visitorToken: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    touch: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return { principal: ANONYMOUS, projectExists: false };

    const owner = await ctx.db.get(project.userId);
    const projectInfo = {
      id: project._id,
      name: project.name,
      ownerUsername: owner?.username ?? "unknown",
      ownerId: project.userId,
      isActive: project.isActive,
      watermarkEnabled: project.watermarkEnabled,
      visitorAuthEnabled: project.visitorAuthEnabled,
      signupEnabled: project.signupEnabled,
      defaultVisitorRole: project.defaultVisitorRole,
      visitsUsedThisMonth: project.visitsUsedThisMonth,
      freeVisitsPerMonth: project.freeVisitsPerMonth,
    };

    const touch = args.touch !== false;
    const ttl = await sessionTimeoutMs(ctx);

    if (args.sessionToken) {
      const session = await findSession(ctx, args.sessionToken);
      if (session && session.kind === "platform" && session.userId) {
        const user = await ctx.db.get(session.userId);
        if (user && !user.isSuspended && (user._id === project.userId || user.role === "admin")) {
          if (touch) {
            await ctx.db.patch(session._id, { expiresAt: Date.now() + ttl, lastAccessedAt: Date.now() });
          }
          return {
            principal: {
              kind: user.role === "admin" && user._id !== project.userId ? "admin" : "owner",
              permissions: [...ALL_PERMISSIONS],
              roleName: "Owner",
              username: user.username,
              userId: user._id,
              sessionId: args.sessionToken,
              ip: args.ip,
            },
            projectExists: true,
            project: projectInfo,
          };
        }
      }
    }

    if (args.apiKey) {
      const resolved = await resolveApiKey(ctx, args.apiKey);
      if (resolved && resolved.project._id === args.projectId) {
        const roles = await ctx.db
          .query("roles")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect();
        const role = roles.find((candidate) => candidate.name === resolved.apiKey.roleName);
        const granted = (role?.permissions as Record<string, boolean> | undefined) ?? {};
        const permissions = API_KEY_PERMISSIONS.filter(
          (permission) => granted[permission] === undefined || granted[permission],
        );
        await ctx.db.patch(resolved.apiKey._id, { lastUsedAt: Date.now() });
        return {
          principal: {
            kind: "api_key",
            permissions: [...permissions],
            roleName: resolved.apiKey.roleName,
            username: `${resolved.apiKey.name} (API key)`,
            userId: resolved.apiKey.userId,
            ip: args.ip,
          },
          projectExists: true,
          project: projectInfo,
        };
      }
      return { principal: ANONYMOUS, projectExists: true, invalidApiKey: true, project: projectInfo };
    }

    const visitor = await visitorPrincipal(ctx, args.projectId, args.visitorToken);
    if (visitor) {
      if (touch && visitor.sessionId) {
        const session = await findSession(ctx, visitor.sessionId);
        if (session) {
          await ctx.db.patch(session._id, { expiresAt: Date.now() + ttl, lastAccessedAt: Date.now() });
        }
      }
      return { principal: visitor.principal, projectExists: true, project: projectInfo };
    }

    return {
      principal: { ...ANONYMOUS, ip: args.ip },
      projectExists: true,
      visitorAuthEnabled: project.visitorAuthEnabled,
      project: projectInfo,
    };
  },
});

/* ------------------------------------------------------------------ *
 * CAPTCHA
 * ------------------------------------------------------------------ */

export const issueCaptcha = internalMutation({
  args: {},
  returns: v.object({ captchaId: v.string(), question: v.string() }),
  handler: async (ctx) => {
    const left = 2 + Math.floor(Math.random() * 8);
    const right = 1 + Math.floor(Math.random() * 9);
    const useAddition = Math.random() > 0.35;
    const answer = useAddition ? left + right : Math.max(left, right) - Math.min(left, right);
    const question = useAddition
      ? `${left} + ${right}`
      : `${Math.max(left, right)} − ${Math.min(left, right)}`;
    const captchaId = randomId("cap");
    await ctx.db.insert("captchas", {
      captchaId,
      answer: String(answer),
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    });
    return { captchaId, question };
  },
});

async function consumeCaptcha(
  ctx: MutationCtx,
  captchaId: string | undefined,
  answer: string | undefined,
) {
  if (!captchaId || answer === undefined || answer === "") {
    fail("Solve the CAPTCHA to continue", 400, "captcha_required");
  }
  const row = await ctx.db
    .query("captchas")
    .withIndex("by_captcha_id", (q) => q.eq("captchaId", captchaId))
    .unique();
  if (!row) fail("CAPTCHA expired. Reload the page and try again.", 400, "captcha_expired");
  if (row.expiresAt < Date.now()) {
    await ctx.db.delete(row._id);
    fail("CAPTCHA expired. Reload the page and try again.", 400, "captcha_expired");
  }
  if (row.answer !== String(answer).trim()) {
    // The challenge stays valid so a typo can be retried without a reload; the
    // row is single-use only once it has been answered correctly.
    fail("Incorrect CAPTCHA answer", 400, "captcha_incorrect");
  }
  await ctx.db.delete(row._id);
}

/* ------------------------------------------------------------------ *
 * Visitor authentication (per project, P-17)
 * ------------------------------------------------------------------ */

async function issueVisitorSession(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    visitorId: Id<"visitors">;
    roleName: string;
    username: string;
    ip?: string;
    userAgent?: string;
  },
): Promise<string> {
  const secret = await ensureSigningSecret(ctx);
  const ttl = await sessionTimeoutMs(ctx);
  const sessionToken = randomId("vs");
  const now = Date.now();
  await ctx.db.insert("sessions", {
    token: sessionToken,
    kind: "visitor",
    projectId: args.projectId,
    visitorId: args.visitorId,
    data: { role: args.roleName, username: args.username },
    ip: args.ip,
    userAgent: args.userAgent,
    createdAt: now,
    expiresAt: now + ttl,
    lastAccessedAt: now,
  });
  return signJwt(
    {
      sid: sessionToken,
      sub: String(args.visitorId),
      project_id: String(args.projectId),
      role: args.roleName,
      username: args.username,
    },
    secret,
    Math.floor(ttl / 1000),
  );
}

export const visitorSignup = internalMutation({
  args: {
    projectId: v.id("projects"),
    username: v.string(),
    password: v.string(),
    captchaId: v.optional(v.string()),
    captchaAnswer: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    if (!project.visitorAuthEnabled) fail("Visitor signup is disabled for this project", 403, "signup_disabled");
    if (!project.signupEnabled) fail("Visitor signup is disabled for this project", 403, "signup_disabled");
    await consumeCaptcha(ctx, args.captchaId, args.captchaAnswer);
    const username = validateVisitorUsername(args.username);
    const password = validatePassword(args.password);
    const existing = await ctx.db
      .query("visitors")
      .withIndex("by_project_username", (q) => q.eq("projectId", project._id).eq("username", username))
      .unique();
    if (existing) fail("That username is already taken", 409, "visitor_exists");
    const role = await ctx.db
      .query("roles")
      .withIndex("by_project_name", (q) => q.eq("projectId", project._id).eq("name", project.defaultVisitorRole))
      .unique();
    const now = Date.now();
    const visitorId = await ctx.db.insert("visitors", {
      projectId: project._id,
      username,
      passwordHash: await hashPassword(password),
      roleId: role?._id,
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });
    const roleName = role?.name ?? "Member";
    const token = await issueVisitorSession(ctx, {
      projectId: project._id,
      visitorId,
      roleName,
      username,
      ip: args.ip,
      userAgent: args.userAgent,
    });
    await emitEvent(ctx, {
      projectId: project._id,
      event: "user.signup",
      data: { username, role: roleName },
    });
    await audit(ctx, {
      level: "info",
      event: "visitor.signup",
      message: `Visitor ${username} signed up`,
      projectId: project._id,
    });
    return { success: true, token, projectId: String(project._id), visitorId: String(visitorId), username, roleName };
  },
});

export const visitorLogin = internalMutation({
  args: {
    projectId: v.id("projects"),
    username: v.string(),
    password: v.string(),
    captchaId: v.optional(v.string()),
    captchaAnswer: v.optional(v.string()),
    requireCaptcha: v.optional(v.boolean()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    if (!project.visitorAuthEnabled) fail("Visitor login is disabled for this project", 403, "login_disabled");
    if (args.requireCaptcha !== false) await consumeCaptcha(ctx, args.captchaId, args.captchaAnswer);
    const settings = await readConfig<{ max_login_attempts: number; lockout_minutes: number }>(ctx, "auth");
    const username = String(args.username ?? "").trim();
    const visitor = await ctx.db
      .query("visitors")
      .withIndex("by_project_username", (q) => q.eq("projectId", project._id).eq("username", username))
      .unique();
    if (!visitor) fail("Invalid username or password", 401, "invalid_credentials");
    if (!visitor.isActive) fail("This visitor account is disabled", 403, "visitor_disabled");
    if (visitor.lockoutUntil && visitor.lockoutUntil > Date.now()) {
      fail("Too many failed attempts. Try again shortly.", 429, "locked_out");
    }
    const valid = await verifyPassword(args.password ?? "", visitor.passwordHash);
    if (!valid) {
      const attempts = visitor.failedLoginAttempts + 1;
      const locked = attempts >= settings.max_login_attempts;
      await ctx.db.patch(visitor._id, {
        failedLoginAttempts: locked ? 0 : attempts,
        lockoutUntil: locked ? Date.now() + settings.lockout_minutes * 60 * 1000 : undefined,
        updatedAt: Date.now(),
      });
      fail("Invalid username or password", 401, "invalid_credentials");
    }
    const role = visitor.roleId ? await ctx.db.get(visitor.roleId) : null;
    const roleName = role?.name ?? "Member";
    await ctx.db.patch(visitor._id, {
      failedLoginAttempts: 0,
      lockoutUntil: undefined,
      lastLoginAt: Date.now(),
      updatedAt: Date.now(),
    });
    const token = await issueVisitorSession(ctx, {
      projectId: project._id,
      visitorId: visitor._id,
      roleName,
      username: visitor.username,
      ip: args.ip,
      userAgent: args.userAgent,
    });
    await emitEvent(ctx, {
      projectId: project._id,
      event: "user.login",
      data: { username: visitor.username, role: roleName },
    });
    return {
      success: true,
      token,
      projectId: String(project._id),
      visitorId: String(visitor._id),
      username: visitor.username,
      roleName,
    };
  },
});

export const visitorLogout = internalMutation({
  args: { projectId: v.optional(v.id("projects")), visitorToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.visitorToken) return null;
    const secret = await readSigningSecret(ctx);
    if (!secret) return null;
    const claims = verifyJwt(args.visitorToken, secret);
    const sid = typeof claims?.sid === "string" ? claims.sid : undefined;
    if (!sid) return null;
    const session = await findSession(ctx, sid);
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});

export const visitorMe = internalQuery({
  args: { projectId: v.id("projects"), visitorToken: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (!args.visitorToken) return null;
    const secret = await readSigningSecret(ctx);
    if (!secret) return null;
    const claims = verifyJwt(args.visitorToken, secret);
    const sid = typeof claims?.sid === "string" ? claims.sid : undefined;
    if (!sid) return null;
    const session = await findSession(ctx, sid);
    if (!session || !session.visitorId || session.projectId !== args.projectId) return null;
    const visitor = await ctx.db.get(session.visitorId);
    if (!visitor) return null;
    const role = visitor.roleId ? await ctx.db.get(visitor.roleId) : null;
    const permissions = Object.entries((role?.permissions as Record<string, boolean> | undefined) ?? {})
      .filter(([, granted]) => granted)
      .map(([name]) => name);
    return {
      id: String(visitor._id),
      username: visitor.username,
      role: role?.name ?? "Member",
      permissions: permissions as Permission[],
      expiresAt: session.expiresAt,
    };
  },
});

/** Ensures the platform's secret material exists before the first encrypted write. */
export const ensurePlatformSecrets = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ensureMasterKey(ctx);
    await ensureSigningSecret(ctx);
    return null;
  },
});

/**
 * Operator/admin console APIs (Blueprint §9): user and project administration,
 * impersonation, platform stats, public library and system configuration.
 * Every handler requires is_admin.
 *
 * Listings are filtered, sorted and paged **in SQL**: an operator console that
 * ships the whole users table to the browser stops being usable the moment a
 * platform has real traffic, and the count query keeps the pager honest.
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { getSessionUser } from "@/lib/server/sessions";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  createImpersonationSession,
  endImpersonation,
  SESSION_COOKIE,
  sessionCookieMaxAgeSeconds,
} from "@/lib/server/sessions";
import {
  configAll,
  configTree,
  invalidateConfig,
  settingFlag,
  SYSTEM_CONFIG_DEFAULTS,
} from "@/lib/server/system-config";
import { CRON_TASKS, cronGlobalKey } from "@/lib/server/cron-tasks";
import { getUserById, listFiles, putFile, deleteFile } from "@/lib/server/repos";
import { sanitizeRelativePath } from "@/lib/server/storage-routes";
import { setting } from "@/lib/server/system-config";
import { createLogger } from "@/lib/server/logger";

/** Admin actions are audit-worthy (§9.4): who did what to which record. */
const log = createLogger("admin");

function bind(value: boolean): number | boolean {
  const p = getDb().driver;
  return p === "sqlite" ? (value ? 1 : 0) : value;
}

/**
 * Console access tiers (users.is_admin / users.is_operator).
 *
 * An **operator** runs the platform day to day: read every account and project,
 * suspend and unlock, edit configuration, run cron, and impersonate ordinary
 * users. An **admin** additionally holds the powers that must not be reachable
 * from an operator account, because they let somebody take over the platform:
 * granting or revoking admin/operator, editing and deleting accounts and
 * projects outright, and impersonating another admin.
 *
 * Before this split existed an operator could not reach /admin at all, which
 * made the flag decorative. `requireOperator` is the gate for the console;
 * `requireAdmin` is the stricter one and is only applied to the endpoints listed
 * above.
 */
async function consoleRole(request: Request): Promise<{
  principal: Awaited<ReturnType<typeof requireSessionUser>>;
  isAdmin: boolean;
  isOperator: boolean;
}> {
  const principal = await requireSessionUser(request);
  const db = getDb();
  const rows = await db.raw<{ is_admin: number | boolean; is_operator: number | boolean }>(
    `SELECT is_admin, is_operator FROM users WHERE id = ${placeholder(db.driver, 0)}`,
    [principal.userId!],
  );
  const row = rows[0];
  const isAdmin = Boolean(row && (row.is_admin === 1 || row.is_admin === true));
  const isOperator = isAdmin || Boolean(row && (row.is_operator === 1 || row.is_operator === true));
  return { principal, isAdmin, isOperator };
}

/** Require an admin session, or throw 403. */
export async function requireAdmin(request: Request) {
  const { principal, isAdmin } = await consoleRole(request);
  if (!isAdmin) throw new ApiError("forbidden", "Admin access required.");
  return principal;
}

/** Require an operator (or admin) session, or throw 403. */
export async function requireOperator(request: Request) {
  const { principal, isAdmin, isOperator } = await consoleRole(request);
  if (!isOperator) throw new ApiError("forbidden", "Operator access required.");
  return { ...principal, isAdmin, isOperator };
}

/** Guard an action that could hand somebody control of the platform. */
function requireFullAdmin(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new ApiError(
      "forbidden",
      "Only an admin can change roles or delete accounts. Ask an admin to make this change.",
    );
  }
}

/** Server-side paging shared by the users and projects listings. */
interface Paging {
  page: number;
  pageSize: number;
  offset: number;
}

function readPaging(url: URL): Paging {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** GET /api/admin/stats — platform totals for the admin dashboard. */
export const adminStats = handler(async (request) => {
  await requireOperator(request);
  const db = getDb();
  const [users, projects, visits, storage] = await Promise.all([
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM users`),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM projects`),
    db.raw<{ n: number | string; month: number | string }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN visited_at >= ${placeholder(db.driver, 1)} THEN 1 ELSE 0 END), 0) AS month
       FROM visit_logs`,
      [`${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`],
    ),
    db.raw<{ n: number | string }>(`SELECT COALESCE(SUM(size_bytes), 0) AS n FROM files`),
  ]);
  return apiOk({
    users: Number(users[0]?.n ?? 0),
    projects: Number(projects[0]?.n ?? 0),
    visitsAllTime: Number(visits[0]?.n ?? 0),
    visitsThisMonth: Number(visits[0]?.month ?? 0),
    storageBytes: Number(storage[0]?.n ?? 0),
  });
});

// ---------------------------------------------------------------- users

/**
 * GET /api/admin/users?page=&pageSize=&q=&status=all|active|admin|suspended|locked&sort=
 */
export const adminUsersList = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const db = getDb();
  const p = db.driver;
  const { page, pageSize, offset } = readPaging(url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const sort = url.searchParams.get("sort") ?? "id";
  const boolTrue = bind(true);

  const where: string[] = [];
  const params: unknown[] = [];
  if (query) {
    // Two columns, two placeholders: SQLite placeholders are positional, so the
    // pattern has to be bound once per occurrence rather than shared.
    const pattern = `%${query}%`;
    params.push(pattern, pattern);
    where.push(
      `(LOWER(u.username) LIKE ${placeholder(p, params.length - 2)} OR LOWER(COALESCE(u.email, '')) LIKE ${placeholder(p, params.length - 1)})`,
    );
  }
  if (status === "admin") where.push(`u.is_admin = ${boolTrue}`);
  else if (status === "suspended") where.push(`u.is_suspended = ${boolTrue}`);
  else if (status === "active") where.push(`u.is_suspended = ${bind(false)}`);
  else if (status === "locked") {
    params.push(new Date().toISOString());
    where.push(`u.locked_until IS NOT NULL AND u.locked_until > ${placeholder(p, params.length - 1)}`);
  }

  const orderBy = (() => {
    switch (sort) {
      case "username":
        return "u.username ASC";
      case "storage":
        return "storage_used DESC, u.id ASC";
      case "projects":
        return "project_count DESC, u.id ASC";
      case "lastLogin":
        return "u.last_login DESC NULLS LAST, u.id ASC";
      default:
        return "u.id ASC";
    }
  })();

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totals = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM users u ${whereSql}`,
    params,
  );
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT u.id, u.username, u.email, u.is_admin, u.is_operator, u.is_suspended, u.storage_cap_bytes,
            u.created_at, u.last_login, u.locked_until,
            (SELECT COUNT(*) FROM projects pr WHERE pr.user_id = u.id) AS project_count,
            (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f JOIN projects pr ON pr.id = f.project_id
             WHERE pr.user_id = u.id) AS storage_used
     FROM users u ${whereSql} ORDER BY ${orderBy}
     LIMIT ${placeholder(p, params.length)} OFFSET ${placeholder(p, params.length + 1)}`,
    [...params, pageSize, offset],
  );

  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      email: (row.email as string | null) ?? null,
      isAdmin: row.is_admin === 1 || row.is_admin === true,
      isOperator: row.is_operator === 1 || row.is_operator === true,
      isSuspended: row.is_suspended === 1 || row.is_suspended === true,
      storageCapBytes: Number(row.storage_cap_bytes ?? 0),
      storageUsedBytes: Number(row.storage_used ?? 0),
      projectCount: Number(row.project_count ?? 0),
      createdAt: String(row.created_at ?? ""),
      lastLogin: (row.last_login as string | null) ?? null,
      lockedUntil: (row.locked_until as string | null) ?? null,
    })),
    page,
    pageSize,
    total: Number(totals[0]?.n ?? 0),
  });
});

/** GET /api/admin/users?userId=N — one account, its projects and its usage. */
export const adminUserDetail = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError("bad_request", "userId query parameter is required.");
  }
  const user = await getUserById(userId);
  if (!user) throw new ApiError("not_found", "Account not found.");
  const db = getDb();
  const p = db.driver;
  const projects = await db.raw<Record<string, unknown>>(
    `SELECT pr.id, pr.name, pr.is_active, pr.free_visits_per_month, pr.created_at,
            (SELECT COUNT(*) FROM files f WHERE f.project_id = pr.id) AS file_count,
            (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.project_id = pr.id) AS storage_bytes
     FROM projects pr WHERE pr.user_id = ${placeholder(p, 0)} ORDER BY pr.id`,
    [userId],
  );
  const visitors = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visitors v JOIN projects pr ON pr.id = v.project_id WHERE pr.user_id = ${placeholder(p, 0)}`,
    [userId],
  );
  return apiOk({
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isOperator: user.isOperator,
      isSuspended: user.isSuspended,
      storageCapBytes: user.storageCapBytes,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      lockedUntil: user.lockedUntil ?? null,
      visitorCount: Number(visitors[0]?.n ?? 0),
      projects: projects.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        isActive: row.is_active === 1 || row.is_active === true,
        freeVisitsPerMonth: Number(row.free_visits_per_month ?? 0),
        fileCount: Number(row.file_count ?? 0),
        storageBytes: Number(row.storage_bytes ?? 0),
        createdAt: String(row.created_at ?? ""),
      })),
    },
  });
});

const userPatchSchema = z
  .object({
    userId: z.number().int().positive().optional(),
    userIds: z.array(z.number().int().positive()).min(1).optional(),
    isSuspended: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    isOperator: z.boolean().optional(),
    unlock: z.boolean().optional(),
    storageCapBytes: z.number().int().min(0).optional(),
  })
  .refine((value) => value.userId !== undefined || value.userIds !== undefined, {
    message: "userId or userIds is required",
  });

/**
 * PATCH /api/admin/users — suspend/resume, promote, unlock or re-cap one or many
 * accounts. §10.storage.max_user_cap_bytes bounds what an operator may grant;
 * reading it here rather than baking the ceiling into the schema is what makes
 * the config key actually control anything.
 */
export const adminUsersPatch = handler(async (request) => {
  const { username: principalName, userId: principalId, isAdmin } = await requireOperator(request);
  const principal = { username: principalName, userId: principalId };
  const body = await parseJson(request, userPatchSchema);
  const ids = body.userIds ?? (body.userId !== undefined ? [body.userId] : []);
  if (ids.length === 0) throw new ApiError("bad_request", "Nothing to update.");

  // Granting admin/operator is the one thing in this endpoint an operator must
  // not be able to do — it is how an operator escalates to full platform
  // control.
  if (body.isAdmin !== undefined || body.isOperator !== undefined) requireFullAdmin(isAdmin);

  const maxCapBytes = await setting("storage.max_user_cap_bytes");
  if (body.storageCapBytes !== undefined && body.storageCapBytes > maxCapBytes) {
    throw new ApiError(
      "bad_request",
      `A storage cap above ${Math.round(maxCapBytes / 1024 / 1024)} MB needs storage.max_user_cap_bytes raised first.`,
    );
  }

  const db = getDb();
  const p = db.driver;
  const changed: string[] = [];
  let affected = 0;
  for (const id of ids) {
    // Locking yourself out of the console is not a recoverable mistake.
    if (id === principal.userId && (body.isSuspended === true || body.isAdmin === false)) {
      throw new ApiError("bad_request", "You cannot suspend or demote your own account.");
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.isSuspended !== undefined) {
      sets.push(`is_suspended = ${placeholder(p, values.length)}`);
      values.push(bind(body.isSuspended));
      // Resuming also clears any lockout.
      if (!body.isSuspended) {
        sets.push(`locked_until = ${placeholder(p, values.length)}`);
        values.push(null);
      }
      changed.push("isSuspended");
    }
    if (body.unlock) {
      sets.push(`locked_until = ${placeholder(p, values.length)}`);
      values.push(null);
      changed.push("unlock");
    }
    if (body.isAdmin !== undefined) {
      sets.push(`is_admin = ${placeholder(p, values.length)}`);
      values.push(bind(body.isAdmin));
      changed.push("isAdmin");
    }
    if (body.isOperator !== undefined) {
      sets.push(`is_operator = ${placeholder(p, values.length)}`);
      values.push(bind(body.isOperator));
      changed.push("isOperator");
    }
    if (body.storageCapBytes !== undefined) {
      sets.push(`storage_cap_bytes = ${placeholder(p, values.length)}`);
      values.push(body.storageCapBytes);
      changed.push("storageCapBytes");
    }
    if (sets.length === 0) continue;
    sets.push(`updated_at = ${placeholder(p, values.length)}`);
    values.push(new Date().toISOString());
    values.push(id);
    const result = await db.run(
      `UPDATE users SET ${sets.join(", ")} WHERE id = ${placeholder(p, values.length - 1)}`,
      values,
    );
    affected += result.changes;
  }
  if (changed.length === 0) throw new ApiError("bad_request", "Nothing to update.");
  log.info("admin.users_patched", { by: principal.username, userIds: ids, changed, affected });
  return apiOk({ success: true, affected, changed });
});

const userDeleteSchema = z.object({
  userId: z.number().int().positive(),
  confirmUsername: z.string().min(1).max(64),
});

/**
 * DELETE /api/admin/users — remove an account and everything it owns. Projects,
 * files, visitors and sessions cascade from the users row, so the console makes
 * the operator type the username they are about to destroy.
 */
export const adminUsersDelete = handler(async (request) => {
  const principal = await requireAdmin(request);
  const body = await parseJson(request, userDeleteSchema);
  if (body.userId === principal.userId) {
    throw new ApiError("bad_request", "You cannot delete your own account.");
  }
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<{ username: string }>(
    `SELECT username FROM users WHERE id = ${placeholder(p, 0)}`,
    [body.userId],
  );
  const target = rows[0]?.username;
  if (!target) throw new ApiError("not_found", "Account not found.");
  if (target !== body.confirmUsername) {
    throw new ApiError("bad_request", `Type "${target}" exactly to confirm deletion.`);
  }
  await db.run(`DELETE FROM users WHERE id = ${placeholder(p, 0)}`, [body.userId]);
  log.warn("admin.user_deleted", { by: principal.username, userId: body.userId, username: target });
  return apiOk({ success: true });
});

// ----------------------------------------------------------- projects

/**
 * GET /api/admin/projects?page=&pageSize=&q=&owner=&status=all|active|suspended|owner-suspended&sort=
 */
export const adminProjectsList = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const db = getDb();
  const p = db.driver;
  const { page, pageSize, offset } = readPaging(url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const owner = (url.searchParams.get("owner") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const sort = url.searchParams.get("sort") ?? "id";
  const boolTrue = bind(true);

  const where: string[] = [];
  const params: unknown[] = [];
  if (query) {
    const pattern = `%${query}%`;
    params.push(pattern, pattern);
    where.push(
      `(LOWER(pr.name) LIKE ${placeholder(p, params.length - 2)} OR LOWER(u.username) LIKE ${placeholder(p, params.length - 1)})`,
    );
  }
  if (owner) {
    params.push(owner);
    where.push(`LOWER(u.username) = ${placeholder(p, params.length - 1)}`);
  }
  if (status === "active") where.push(`pr.is_active = ${boolTrue} AND u.is_suspended = ${bind(false)}`);
  else if (status === "suspended") where.push(`pr.is_active = ${bind(false)}`);
  else if (status === "owner-suspended") where.push(`u.is_suspended = ${boolTrue}`);

  const orderBy = (() => {
    switch (sort) {
      case "name":
        return "pr.name ASC";
      case "files":
        return "file_count DESC, pr.id ASC";
      case "storage":
        return "storage_bytes DESC, pr.id ASC";
      case "visits":
        return "visit_count DESC, pr.id ASC";
      default:
        return "pr.id ASC";
    }
  })();

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totals = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM projects pr JOIN users u ON u.id = pr.user_id ${whereSql}`,
    params,
  );
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT pr.id, pr.name, pr.user_id, pr.is_active, pr.free_visits_per_month, pr.created_at,
            u.username, u.is_suspended,
            (SELECT COUNT(*) FROM files f WHERE f.project_id = pr.id) AS file_count,
            (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.project_id = pr.id) AS storage_bytes,
            (SELECT COUNT(*) FROM visit_logs v WHERE v.project_id = pr.id) AS visit_count,
            (SELECT MAX(v.visited_at) FROM visit_logs v WHERE v.project_id = pr.id) AS last_visit
     FROM projects pr JOIN users u ON u.id = pr.user_id ${whereSql} ORDER BY ${orderBy}
     LIMIT ${placeholder(p, params.length)} OFFSET ${placeholder(p, params.length + 1)}`,
    [...params, pageSize, offset],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      userId: Number(row.user_id),
      username: String(row.username),
      isActive: row.is_active === 1 || row.is_active === true,
      ownerSuspended: row.is_suspended === 1 || row.is_suspended === true,
      freeVisitsPerMonth: Number(row.free_visits_per_month ?? 0),
      fileCount: Number(row.file_count ?? 0),
      storageBytes: Number(row.storage_bytes ?? 0),
      visitCount: Number(row.visit_count ?? 0),
      lastVisit: (row.last_visit as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
    page,
    pageSize,
    total: Number(totals[0]?.n ?? 0),
  });
});

const projectPatchSchema = z
  .object({
    projectId: z.number().int().positive().optional(),
    projectIds: z.array(z.number().int().positive()).min(1).optional(),
    isActive: z.boolean().optional(),
    freeVisitsPerMonth: z.number().int().min(0).max(1_000_000).optional(),
    watermarkEnabled: z.boolean().optional(),
  })
  .refine((value) => value.projectId !== undefined || value.projectIds !== undefined, {
    message: "projectId or projectIds is required",
  });

/** PATCH /api/admin/projects — suspend/resume, re-quota or toggle watermarks. */
export const adminProjectsPatch = handler(async (request) => {
  const { username: principalName } = await requireOperator(request);
  const principal = { username: principalName };
  const body = await parseJson(request, projectPatchSchema);
  const ids = body.projectIds ?? (body.projectId !== undefined ? [body.projectId] : []);
  if (ids.length === 0) throw new ApiError("bad_request", "Nothing to update.");
  const db = getDb();
  const p = db.driver;
  let affected = 0;
  for (const id of ids) {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.isActive !== undefined) {
      sets.push(`is_active = ${placeholder(p, values.length)}`);
      values.push(bind(body.isActive));
    }
    if (body.freeVisitsPerMonth !== undefined) {
      sets.push(`free_visits_per_month = ${placeholder(p, values.length)}`);
      values.push(body.freeVisitsPerMonth);
    }
    if (body.watermarkEnabled !== undefined) {
      sets.push(`watermark_enabled = ${placeholder(p, values.length)}`);
      values.push(bind(body.watermarkEnabled));
    }
    if (sets.length === 0) continue;
    sets.push(`updated_at = ${placeholder(p, values.length)}`);
    values.push(new Date().toISOString());
    values.push(id);
    const result = await db.run(
      `UPDATE projects SET ${sets.join(", ")} WHERE id = ${placeholder(p, values.length - 1)}`,
      values,
    );
    affected += result.changes;
  }
  log.info("admin.projects_patched", { by: principal.username, projectIds: ids, affected });
  return apiOk({ success: true, affected });
});

const projectDeleteSchema = z.object({
  projectId: z.number().int().positive(),
  confirmName: z.string().min(1).max(64),
});

/** DELETE /api/admin/projects — remove a project and its stored data. */
export const adminProjectsDelete = handler(async (request) => {
  const principal = await requireAdmin(request);
  const body = await parseJson(request, projectDeleteSchema);
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<{ name: string }>(
    `SELECT name FROM projects WHERE id = ${placeholder(p, 0)}`,
    [body.projectId],
  );
  const target = rows[0]?.name;
  if (!target) throw new ApiError("not_found", "Project not found.");
  if (target !== body.confirmName) {
    throw new ApiError("bad_request", `Type "${target}" exactly to confirm deletion.`);
  }
  await db.run(`DELETE FROM projects WHERE id = ${placeholder(p, 0)}`, [body.projectId]);
  log.warn("admin.project_deleted", { by: principal.username, projectId: body.projectId, name: target });
  return apiOk({ success: true });
});

// -------------------------------------------------------- impersonation

const impersonateSchema = z.object({ userId: z.number().int().positive() });

/**
 * POST /api/admin/impersonate — sign in as another console user.
 *
 * A session swap rather than a sudo flag on the operator's own session: the
 * operator's session id travels inside the impersonation row, so "stop" hands
 * control back to exactly the session they had. The target's own admin flag is
 * what the new session carries, so impersonating a non-admin cannot escalate,
 * and every switch is written to the admin audit log.
 */
export const adminImpersonateStart = handler(async (request) => {
  const { username: principalName, userId: principalId, isAdmin } = await requireOperator(request);
  const principal = { username: principalName, userId: principalId };
  const body = await parseJson(request, impersonateSchema);
  if (body.userId === principal.userId) {
    throw new ApiError("bad_request", "You are already signed in as this account.");
  }
  const target = await getUserById(body.userId);
  if (!target) throw new ApiError("not_found", "Account not found.");
  if (target.isSuspended) {
    throw new ApiError("bad_request", "That account is suspended — resume it before impersonating.");
  }
  // Impersonating an admin would hand an operator the whole platform through the
  // session swap, which is the one thing operator access is not allowed to do.
  if (!isAdmin && target.isAdmin) requireFullAdmin(false);

  const { cookies } = await import("next/headers");
  const raw = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const operatorSessionId = raw.slice(0, Math.max(0, raw.lastIndexOf(".")));
  if (!operatorSessionId) throw new ApiError("unauthorized", "No console session to restore.");
  const operatorName = (await getSessionUser())?.username ?? principal.username;
  if (!operatorName) throw new ApiError("unauthorized", "No console session to restore.");

  const token = await createImpersonationSession(
    target.id,
    { username: operatorName, sessionId: operatorSessionId },
    {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  );
  log.warn("admin.impersonation_started", {
    by: operatorName,
    targetId: target.id,
    targetUsername: target.username,
  });

  const response = NextResponse.json({
    success: true,
    impersonated: { username: target.username, id: target.id },
    redirectUrl: "/dashboard",
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: await sessionCookieMaxAgeSeconds(),
  });
  return response;
});

/** POST /api/admin/impersonate/stop — return to the operator's own session. */
export const adminImpersonateStop = handler(async () => {
  const restored = await endImpersonation();
  if (!restored) {
    throw new ApiError(
      "bad_request",
      "This session is not an impersonation, or the operator session has expired. Sign in again.",
    );
  }
  const response = NextResponse.json({ success: true, redirectUrl: "/admin" });
  response.cookies.set(SESSION_COOKIE, restored, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: await sessionCookieMaxAgeSeconds(),
  });
  return response;
});

/** GET /api/admin/impersonate — who, if anyone, this session is standing in for. */
export const adminImpersonateStatus = handler(async () => {
  const user = await getSessionUser();
  return apiOk({ impersonatedBy: user?.impersonatedBy ?? null });
});

// ------------------------------------------------------------ overview

/** GET /api/admin/overview — the headline numbers and busiest projects. */
export const adminOverview = handler(async (request) => {
  const { username, isAdmin, isOperator } = await requireOperator(request);
  const db = getDb();
  const p = db.driver;
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [
    users,
    suspended,
    locked,
    week,
    day,
    newProjects,
    newUsers,
    topProjects,
    storageTotal,
    activeKeys,
    idleKeys,
    activeHooks,
    failedDeliveries,
    verifiedDomains,
    enabledCron,
    liveSessions,
  ] =
    await Promise.all([
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM users`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM users WHERE is_suspended = ${bind(true)}`,
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM users WHERE locked_until IS NOT NULL AND locked_until > ${placeholder(p, 0)}`,
      [new Date().toISOString()],
    ),
    db.raw<{ visits: number | string; unique_visitors: number | string }>(
      `SELECT COUNT(*) AS visits, COUNT(DISTINCT ip) AS unique_visitors
       FROM visit_logs WHERE visited_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<{ visits: number | string; unique_visitors: number | string }>(
      `SELECT COUNT(*) AS visits, COUNT(DISTINCT ip) AS unique_visitors FROM visit_logs WHERE visited_at >= ${placeholder(p, 0)}`,
      [dayAgo],
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM projects WHERE created_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM users WHERE created_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<Record<string, unknown>>(
      `SELECT pr.id, pr.name, u.username, COUNT(v.id) AS visits
       FROM visit_logs v JOIN projects pr ON pr.id = v.project_id JOIN users u ON u.id = pr.user_id
       WHERE v.visited_at >= ${placeholder(p, 0)}
       GROUP BY pr.id, pr.name, u.username ORDER BY visits DESC LIMIT 5`,
      [weekAgo],
    ),
    // Health KPIs an operator actually acts on: what is consuming the database,
    // what is running, and what is stuck.
    db.raw<{ total: number | string }>(`SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files`),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL AND (last_used_at IS NULL OR last_used_at < ${placeholder(p, 0)})`,
      [new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()],
    ),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM webhooks WHERE is_active = ${bind(true)}`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM webhook_deliveries WHERE error_message IS NOT NULL AND delivered_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM domains WHERE is_verified = ${bind(true)}`,
    ),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM cron_configs WHERE is_enabled = ${bind(true)}`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ${placeholder(p, 0)}`,
      [new Date().toISOString()],
    ),
    ]);

  return apiOk({
    users: Number(users[0]?.n ?? 0),
    suspendedUsers: Number(suspended[0]?.n ?? 0),
    lockedUsers: Number(locked[0]?.n ?? 0),
    newProjectsThisWeek: Number(newProjects[0]?.n ?? 0),
    week: {
      visits: Number(week[0]?.visits ?? 0),
      uniqueVisitors: Number(week[0]?.unique_visitors ?? 0),
      newUsers: Number(newUsers[0]?.n ?? 0),
      since: weekAgo,
    },
    last24h: {
      visits: Number(day[0]?.visits ?? 0),
      uniqueVisitors: Number(day[0]?.unique_visitors ?? 0),
    },
    // The console needs its own tier to hide the admin-only controls rather
    // than offering buttons that come back 403.
    viewer: { username, isAdmin, isOperator },
    health: {
      storageBytes: Number(storageTotal[0]?.total ?? 0),
      activeApiKeys: Number(activeKeys[0]?.n ?? 0),
      idleApiKeys: Number(idleKeys[0]?.n ?? 0),
      activeWebhooks: Number(activeHooks[0]?.n ?? 0),
      failedDeliveriesThisWeek: Number(failedDeliveries[0]?.n ?? 0),
      verifiedDomains: Number(verifiedDomains[0]?.n ?? 0),
      enabledCronTasks: Number(enabledCron[0]?.n ?? 0),
      liveSessions: Number(liveSessions[0]?.n ?? 0),
    },
    topProjects: topProjects.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      username: String(row.username),
      visits: Number(row.visits ?? 0),
    })),
  });
});

/** DELETE /api/admin/sessions?userId=N — sign an account out everywhere. */
export const adminSessionsRevoke = handler(async (request) => {
  const { username: principalName, isAdmin } = await requireOperator(request);
  const principal = { username: principalName };
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError("bad_request", "userId query parameter is required.");
  }
  // Signing an admin out everywhere is a denial-of-service primitive against
  // the platform's own administrators, so it stays an admin action.
  if (!isAdmin) {
    const rows = await getDb().raw<{ is_admin: number | boolean }>(
      `SELECT is_admin FROM users WHERE id = ${placeholder(getDb().driver, 0)}`,
      [userId],
    );
    if (rows[0] && (rows[0].is_admin === 1 || rows[0].is_admin === true)) requireFullAdmin(false);
  }
  const db = getDb();
  const result = await db.run(`DELETE FROM sessions WHERE user_id = ${placeholder(db.driver, 0)}`, [
    userId,
  ]);
  log.warn("admin.sessions_revoked", { by: principal.username, userId, revoked: result.changes });
  return apiOk({ success: true, revoked: result.changes });
});

// ------------------------------------------------------------------ cron

/** GET /api/admin/cron — per-task global switches plus due counts (§6.4). */
export const adminCronGet = handler(async (request) => {
  await requireOperator(request);
  const db = getDb();
  const now = new Date().toISOString();
  const due = await db.raw<{ task_name: string; n: number | string }>(
    `SELECT task_name, COUNT(*) AS n FROM cron_configs
     WHERE is_enabled = ${db.driver === "sqlite" ? 1 : "TRUE"}
       AND (next_run_at IS NULL OR next_run_at <= ${placeholder(db.driver, 0)})
     GROUP BY task_name`,
    [now],
  );
  const dueByTask = new Map(due.map((row) => [String(row.task_name), Number(row.n)]));
  const tasks = [];
  for (const task of CRON_TASKS) {
    tasks.push({
      task,
      globallyEnabled: await settingFlag(cronGlobalKey(task)),
      dueProjects: dueByTask.get(task) ?? 0,
    });
  }
  return apiOk({ data: tasks });
});

const globalCronSchema = z.object({
  task: z.enum(CRON_TASKS),
  isEnabled: z.boolean(),
});

/** PUT /api/admin/cron — flip one task's global switch (§6.4 global cron). */
export const adminCronPut = handler(async (request) => {
  await requireOperator(request);
  const body = await parseJson(request, globalCronSchema);
  const db = getDb();
  const p = db.driver;
  const key = cronGlobalKey(body.task);
  const encoded = JSON.stringify(body.isEnabled);
  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM system_configs WHERE config_key = ${placeholder(p, 0)}`,
    [key],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE system_configs SET config_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
      [encoded, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)})`,
      [key, encoded],
    );
  }
  invalidateConfig(key);
  return apiOk({ success: true, task: body.task, isEnabled: body.isEnabled });
});

// ---------------------------------------------------------------- config

/** GET /api/admin/config — effective system configuration. */
export const adminConfigGet = handler(async (request) => {
  await requireOperator(request);
  const effective = await configAll();
  return apiOk({ data: effective, defaults: SYSTEM_CONFIG_DEFAULTS, tree: configTree(effective) });
});

/** GET /api/admin/config — effective configuration as the §10 nested tree. */
export const adminConfigTree = handler(async (request) => {
  await requireOperator(request);
  const effective = await configAll();
  return apiOk({ tree: configTree(effective), data: effective, defaults: SYSTEM_CONFIG_DEFAULTS });
});

const configPutSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.union([z.number(), z.string(), z.boolean()]),
});

/** PUT /api/admin/config — set one system config override (JSON-encoded). */
export const adminConfigSet = handler(async (request) => {
  await requireOperator(request);
  const body = await parseJson(request, configPutSchema);
  if (!(body.key in SYSTEM_CONFIG_DEFAULTS)) {
    throw new ApiError("bad_request", `Unknown config key. Known: ${Object.keys(SYSTEM_CONFIG_DEFAULTS).join(", ")}`);
  }
  const db = getDb();
  const p = db.driver;
  const encoded = JSON.stringify(body.value);
  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM system_configs WHERE config_key = ${placeholder(p, 0)}`,
    [body.key],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE system_configs SET config_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
      [encoded, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)})`,
      [body.key, encoded],
    );
  }
  invalidateConfig(body.key);
  log.info("admin.config_updated", { key: body.key });
  return apiOk({ success: true, key: body.key, value: body.value });
});

// -------------------------------------------------------- public library

const PUBLIC_LIBRARY_PROJECT = "public-library";
const PUBLIC_LIBRARY_PREFIX = "library/public/";

/**
 * The admin's curated public library (§5.3) lives in the admin's own
 * `public-library` project, under `library/public/…`, and is served at
 * /~public/<path>.
 */
async function publicLibraryProject(create: boolean) {
  const db = getDb();
  const rows = await db.raw<{ id: number; user_id: number }>(
    `SELECT pr.id, pr.user_id FROM projects pr JOIN users u ON u.id = pr.user_id
     WHERE u.is_admin = ${db.driver === "sqlite" ? 1 : "TRUE"} AND pr.name = ${placeholder(db.driver, 0)}
     ORDER BY pr.id LIMIT 1`,
    [PUBLIC_LIBRARY_PROJECT],
  );
  if (rows[0]) return { id: Number(rows[0].id), userId: Number(rows[0].user_id) };
  if (!create) return null;
  const admin = await db.raw<{ id: number }>(
    `SELECT id FROM users WHERE is_admin = ${db.driver === "sqlite" ? 1 : "TRUE"} ORDER BY id LIMIT 1`,
  );
  if (!admin[0]) throw new ApiError("forbidden", "No admin account exists.");
  const { createProject } = await import("@/lib/server/repos");
  const project = await createProject(Number(admin[0].id), PUBLIC_LIBRARY_PROJECT);
  return { id: project.id, userId: project.userId };
}

/** GET /api/admin/public-library — assets served from /~public/. */
export const adminPublicLibraryList = handler(async (request) => {
  await requireOperator(request);
  const project = await publicLibraryProject(false);
  if (!project) return apiOk({ data: [] });
  const files = await listFiles(project.id, PUBLIC_LIBRARY_PREFIX);
  return apiOk({
    data: files.map((file) => ({
      path: file.path.slice(PUBLIC_LIBRARY_PREFIX.length),
      size: file.sizeBytes,
      modified: file.updatedAt,
    })),
  });
});

/** PUT /api/admin/public-library?path=theme.css — raw body upload. */
export const adminPublicLibraryPut = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  if (/\.html?$/i.test(path)) throw new ApiError("bad_request", "HTML files cannot be published.");
  const resolved = await publicLibraryProject(true);
  if (!resolved) throw new ApiError("internal_error", "Could not prepare the public library project.");
  const content = Buffer.from(await request.arrayBuffer());
  const record = await putFile(
    resolved.userId,
    resolved.id,
    `${PUBLIC_LIBRARY_PREFIX}${path}`,
    content,
    true,
  );
  log.info("admin.public_library_published", { path, size: record.sizeBytes });
  return apiOk({ success: true, path: `/~public/${path}`, size: record.sizeBytes }, { status: 201 });
});

/** DELETE /api/admin/public-library?path=theme.css */
export const adminPublicLibraryDelete = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  const project = await publicLibraryProject(false);
  if (!project) throw new ApiError("not_found", "Public library is empty.");
  const removed = await deleteFile(project.userId, project.id, `${PUBLIC_LIBRARY_PREFIX}${path}`);
  if (removed === 0) throw new ApiError("not_found", "File not found.");
  log.info("admin.public_library_removed", { path });
  return apiOk({ success: true });
});

/** Resolve the admin public-library file for /~public/<path> serving. */
export async function readPublicLibraryFile(
  path: string,
): Promise<{ content: Buffer; projectId: number } | null> {
  const db = getDb();
  const stored = `${PUBLIC_LIBRARY_PREFIX}${path}`;
  const rows = await db.raw<{ content_text: string | null; content_blob: Buffer | null; project_id: number }>(
    `SELECT f.content_text, f.content_blob, f.project_id FROM files f
     JOIN projects pr ON pr.id = f.project_id JOIN users u ON u.id = pr.user_id
     WHERE u.is_admin = ${db.driver === "sqlite" ? 1 : "TRUE"} AND pr.name = ${placeholder(db.driver, 0)} AND f.path = ${placeholder(db.driver, 1)}
     LIMIT 1`,
    [PUBLIC_LIBRARY_PROJECT, stored],
  );
  const row = rows[0];
  if (!row) return null;
  const content = row.content_text != null
    ? Buffer.from(String(row.content_text), "utf8")
    : Buffer.from(row.content_blob ?? Buffer.alloc(0));
  return { content, projectId: Number(row.project_id) };
}
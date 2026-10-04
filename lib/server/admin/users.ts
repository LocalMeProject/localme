/**
 * Admin and operator endpoints for managing user accounts.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { getUserById } from "@/lib/server/repos";
import { setting } from "@/lib/server/system-config";
import { bind, log, readPaging, requireAdmin, requireFullAdmin, requireOperator } from "./common";

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

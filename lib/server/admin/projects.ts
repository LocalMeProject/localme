/**
 * Admin and operator endpoints for managing platform projects.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { bind, log, readPaging, requireAdmin, requireOperator } from "./common";

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

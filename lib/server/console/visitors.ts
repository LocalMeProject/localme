import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { hashVisitorPassword } from "@/lib/server/visitor-auth";
import { scopedProject, toBool, VISITOR_RE } from "./common";

export interface ConsoleVisitor {
  id: number;
  username: string;
  isActive: boolean;
  role: string;
  createdAt: string;
}

export const consoleVisitorsList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT v.id, v.username, v.is_active, v.created_at, r.name AS role_name
     FROM visitors v LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.project_id = ${placeholder(db.driver, 0)}
     ORDER BY v.username`,
    [project.id],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      isActive: toBool(row.is_active),
      role: (row.role_name as string | null) ?? "Member",
      createdAt: String(row.created_at ?? ""),
    })),
  });
});

export const visitorCreateSchema = z.object({
  username: z.string().regex(VISITOR_RE),
  password: z.string().min(8).max(256),
  role: z.string().max(64).optional(),
});

export const consoleVisitorsCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, visitorCreateSchema);
  const db = getDb();
  const p = db.driver;

  let roleId: number | null = null;
  if (body.role) {
    const roles = await db.raw<{ id: number }>(
      `SELECT id FROM roles
       WHERE project_id = ${placeholder(p, 0)} AND name = ${placeholder(p, 1)}`,
      [project.id, body.role],
    );
    if (!roles[0]) throw new ApiError("bad_request", "Unknown role for this project.");
    roleId = roles[0].id;
  }

  const passwordHash = await hashVisitorPassword(body.password);
  try {
    await db.run(
      `INSERT INTO visitors (project_id, username, password_hash, role_id)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [project.id, body.username, passwordHash, roleId],
    );
  } catch (error) {
    if (/UNIQUE constraint failed|duplicate key value/i.test(error instanceof Error ? error.message : String(error))) {
      throw new ApiError("conflict", "That username is taken for this project.");
    }
    throw error;
  }
  return apiOk({ success: true }, { status: 201 });
});

export const visitorPatchSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9_-]+$/).optional(),
  role: z.string().min(1).max(64).optional(),
  isActive: z.boolean().optional(),
});

export const consoleVisitorsUpdate = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const visitorId = Number((await context.params).visitorId);
  if (!Number.isInteger(visitorId) || visitorId <= 0) {
    throw new ApiError("bad_request", "Invalid visitor id.");
  }
  const body = await parseJson(request, visitorPatchSchema);
  const db = getDb();
  const p = db.driver;

  let roleId: number | null | undefined;
  if (body.role !== undefined) {
    const role = await db.raw<{ id: number }>(
      `SELECT id FROM roles WHERE project_id = ${placeholder(p, 0)} AND name = ${placeholder(p, 1)}`,
      [project.id, body.role],
    );
    if (!role[0]) throw new ApiError("not_found", `No role named "${body.role}" in this project.`);
    roleId = Number(role[0].id);
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.username !== undefined) {
    sets.push(`username = ${placeholder(p, values.length)}`);
    values.push(body.username);
  }
  if (roleId !== undefined) {
    sets.push(`role_id = ${placeholder(p, values.length)}`);
    values.push(roleId);
  }
  if (body.isActive !== undefined) {
    sets.push(`is_active = ${placeholder(p, values.length)}`);
    values.push(p === "sqlite" ? (body.isActive ? 1 : 0) : body.isActive);
  }
  if (sets.length === 0) throw new ApiError("bad_request", "Nothing to update.");
  sets.push(`updated_at = ${placeholder(p, values.length)}`);
  values.push(new Date().toISOString());
  values.push(visitorId);
  try {
    const result = await db.run(
      `UPDATE visitors SET ${sets.join(", ")}
       WHERE id = ${placeholder(p, values.length - 1)} AND project_id = ${placeholder(p, values.length)}`,
      [...values, project.id],
    );
    if (result.changes === 0) throw new ApiError("not_found", "Visitor not found.");
  } catch (error) {
    if (/UNIQUE constraint failed|duplicate key value/i.test(error instanceof Error ? error.message : String(error))) {
      throw new ApiError("conflict", "That username is already taken in this project.");
    }
    throw error;
  }
  return apiOk({ success: true });
});

export const consoleVisitorsDelete = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const visitorId = Number((await context.params).visitorId);
  if (!Number.isInteger(visitorId) || visitorId <= 0) {
    throw new ApiError("bad_request", "Invalid visitor id.");
  }
  const db = getDb();
  const result = await db.run(
    `DELETE FROM visitors WHERE id = ${placeholder(db.driver, 0)} AND project_id = ${placeholder(db.driver, 1)}`,
    [visitorId, project.id],
  );
  if (result.changes === 0) throw new ApiError("not_found", "Visitor not found.");
  return apiOk({ success: true });
});

export const consoleVisitsSummary = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const rows = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visit_logs
     WHERE project_id = ${placeholder(db.driver, 0)} AND visited_at >= ${placeholder(db.driver, 1)}`,
    [project.id, monthStart],
  );
  return apiOk({ visits: Number(rows[0]?.n ?? 0) });
});

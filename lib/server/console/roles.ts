import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { scopedProject, NAME_RE } from "./common";

export interface ConsoleRole {
  id: number;
  name: string;
  permissions: string[];
}

export const consoleRolesList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, name, permissions FROM roles
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY name`,
    [project.id],
  );
  return apiOk({
    data: rows.map((row) => {
      let permissions: string[] = [];
      try {
        const parsed: unknown = JSON.parse(String(row.permissions ?? "[]"));
        if (Array.isArray(parsed)) permissions = parsed.filter((x): x is string => typeof x === "string");
      } catch {
        // Malformed permissions read as empty.
      }
      return { id: Number(row.id), name: String(row.name), permissions };
    }),
  });
});

export const roleCreateSchema = z.object({
  name: z.string().regex(NAME_RE),
  permissions: z.array(z.string().min(1).max(64)).max(64).default([]),
});

export const consoleRolesCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, roleCreateSchema);
  const db = getDb();
  try {
    await db.run(
      `INSERT INTO roles (project_id, name, permissions) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, ${placeholder(db.driver, 2)})`,
      [project.id, body.name, JSON.stringify(body.permissions)],
    );
  } catch (error) {
    if (/UNIQUE constraint failed|duplicate key value/i.test(error instanceof Error ? error.message : String(error))) {
      throw new ApiError("conflict", "A role with that name already exists.");
    }
    throw error;
  }
  return apiOk({ success: true }, { status: 201 });
});

export const consoleRolesUpdate = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const roleId = Number((await context.params).roleId);
  if (!Number.isInteger(roleId) || roleId <= 0) {
    throw new ApiError("bad_request", "roleId must be a positive integer.");
  }
  const body = await parseJson(
    request,
    z.object({
      name: z.string().regex(NAME_RE).optional(),
      permissions: z.array(z.string().min(1).max(64)).max(64).optional(),
    }),
  );
  const db = getDb();
  const p = db.driver;

  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM roles WHERE id = ${placeholder(p, 0)} AND project_id = ${placeholder(p, 1)}`,
    [roleId, project.id],
  );
  if (!existing[0]) throw new ApiError("not_found", "Role not found.");

  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.name !== undefined) {
    sets.push(`name = ${placeholder(p, values.length)}`);
    values.push(body.name);
  }
  if (body.permissions !== undefined) {
    sets.push(`permissions = ${placeholder(p, values.length)}`);
    values.push(JSON.stringify(body.permissions));
  }
  if (sets.length === 0) throw new ApiError("bad_request", "Nothing to update.");
  sets.push(`updated_at = ${placeholder(p, values.length)}`);
  values.push(new Date().toISOString());
  values.push(roleId);
  try {
    await db.run(`UPDATE roles SET ${sets.join(", ")} WHERE id = ${placeholder(p, values.length - 1)}`, values);
  } catch (error) {
    if (/UNIQUE constraint failed|duplicate key value/i.test(error instanceof Error ? error.message : String(error))) {
      throw new ApiError("conflict", "A role with that name already exists.");
    }
    throw error;
  }
  return apiOk({ success: true });
});

export const ROLE_ON_DELETE = ["leave_role", "delete_visitors", "move_to"] as const;
export type RoleOnDelete = (typeof ROLE_ON_DELETE)[number];

export const consoleRolesDelete = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const roleId = Number((await context.params).roleId);
  if (!Number.isInteger(roleId) || roleId <= 0) {
    throw new ApiError("bad_request", "roleId must be a positive integer.");
  }
  const raw = url.searchParams.get("onDelete");
  const onDelete = (raw ?? "leave_role") as RoleOnDelete;
  if (!ROLE_ON_DELETE.includes(onDelete)) {
    throw new ApiError("bad_request", `onDelete must be one of ${ROLE_ON_DELETE.join(", ")}.`);
  }
  const moveToRoleId = url.searchParams.get("moveToRoleId")
    ? Number(url.searchParams.get("moveToRoleId"))
    : undefined;
  if (onDelete === "move_to") {
    if (!moveToRoleId || !Number.isInteger(moveToRoleId)) {
      throw new ApiError("bad_request", "moveToRoleId is required when onDelete=move_to.");
    }
    if (moveToRoleId === roleId) {
      throw new ApiError("bad_request", "A role cannot be moved to itself.");
    }
  }

  const db = getDb();
  const p = db.driver;

  const holders = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visitors WHERE role_id = ${placeholder(p, 0)} AND project_id = ${placeholder(p, 1)}`,
    [roleId, project.id],
  );
  const affected = Number(holders[0]?.n ?? 0);

  if (onDelete === "move_to") {
    const target = await db.raw<{ id: number }>(
      `SELECT id FROM roles WHERE id = ${placeholder(p, 0)} AND project_id = ${placeholder(p, 1)}`,
      [moveToRoleId, project.id],
    );
    if (!target[0]) throw new ApiError("not_found", "Replacement role not found in this project.");
  }

  if (onDelete === "delete_visitors") {
    await db.run(
      `DELETE FROM visitors WHERE role_id = ${placeholder(p, 0)} AND project_id = ${placeholder(p, 1)}`,
      [roleId, project.id],
    );
  } else if (onDelete === "move_to" && moveToRoleId) {
    await db.run(
      `UPDATE visitors SET role_id = ${placeholder(p, 0)}
       WHERE role_id = ${placeholder(p, 1)} AND project_id = ${placeholder(p, 2)}`,
      [moveToRoleId, roleId, project.id],
    );
  }

  const removed = await db.run(
    `DELETE FROM roles WHERE id = ${placeholder(p, 0)} AND project_id = ${placeholder(p, 1)}`,
    [roleId, project.id],
  );
  if (removed.changes === 0) throw new ApiError("not_found", "Role not found.");

  return apiOk({ success: true, visitorsMoved: affected, onDelete });
});

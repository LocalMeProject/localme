/**
 * Console management endpoints for the project configuration entities that
 * have no public REST surface: serving routes, API keys, visitors, roles, and
 * the document-store table list (Blueprint §6.3 project configuration APIs).
 *
 * All of them require a signed-in console session and an owned project
 * (requireSessionUser + requireOwnedProject) — API keys, visitors, and routes
 * are never managed by machine principals.
 */
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requirePermission } from "@/lib/server/api-auth";
import { createLogger } from "@/lib/server/logger";
import {
  createApiKey,
  getFileBlob,
  listFiles,
  PERMISSIONS,
  requireOwnedProject,
  storageUsedBytes,
  type ProjectRecord,
} from "@/lib/server/repos";
import { DB_ENDPOINTS } from "@/lib/server/db-routes";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { hashVisitorPassword } from "@/lib/server/visitor-auth";
import { buildZip } from "@/lib/server/zip";
import { provisionCertificate, renewExpiringCertificates, sslStatus } from "@/lib/server/ssl";

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
const VISITOR_RE = /^[a-z0-9_-]{3,32}$/;

async function scopedProject(
  request: Request,
  projectIdParam: string | null,
  permission?: string,
): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  if (permission) requirePermission(principal, permission);
  return requireOwnedProject(principal.userId!, projectId);
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

// ---------------------------------------------------------------- routes

export interface ConsoleRoute {
  id: number;
  projectId: number;
  pathPattern: string;
  targetFile: string | null;
  isProxy: boolean;
  requiresAuth: boolean;
  requiredRole: string | null;
  /** One §5.5 permission the visitor's role must carry, or null. */
  requiredPermission: string | null;
  isActive: boolean;
}

function mapRoute(row: Record<string, unknown>): ConsoleRoute {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    pathPattern: String(row.path_pattern),
    targetFile: (row.target_file as string | null) ?? null,
    isProxy: toBool(row.is_proxy),
    requiresAuth: toBool(row.requires_auth),
    requiredRole: (row.required_role as string | null) ?? null,
    requiredPermission: (row.required_permission as string | null) ?? null,
    isActive: toBool(row.is_active),
  };
}

const ROUTE_COLUMNS =
  "id, project_id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, required_permission, is_active";

/** GET /api/routes?projectId=N — routes of one owned project. */
export const consoleRoutesList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT ${ROUTE_COLUMNS} FROM routes
     WHERE project_id = ${placeholder(db.driver, 0)}
     ORDER BY path_pattern`,
    [project.id],
  );
  return apiOk({ data: rows.map(mapRoute) });
});

const routeSchema = z.object({
  pathPattern: z.string().regex(/^\/.{0,255}$/),
  targetFile: z.string().max(512).optional().nullable(),
  isProxy: z.boolean().default(false),
  proxyConfig: z.unknown().optional(),
  requiresAuth: z.boolean().default(false),
  requiredRole: z.string().max(64).optional().nullable(),
  // One granular permission from §5.5, or null for "role only".
  requiredPermission: z.enum(PERMISSIONS).optional().nullable(),
  isActive: z.boolean().default(true),
});

/** Prefixes users may never route over (Blueprint §5.4 reserved prefixes). */
export const RESERVED_ROUTE_PREFIXES = ["/api", "/auth", "/admin", "/dashboard", "/library", "/~public", "/_next", "/docs", "/health"];

function validateRouteBody(body: z.infer<typeof routeSchema>): {
  targetFile: string | null;
  proxyConfig: string | null;
  requiredRole: string | null;
  requiredPermission: string | null;
} {
  const pathPattern = body.pathPattern.trim();
  const reserved = RESERVED_ROUTE_PREFIXES.find(
    (prefix) => pathPattern === prefix || pathPattern.startsWith(`${prefix}/`),
  );
  if (reserved) {
    throw new ApiError(
      "bad_request",
      `Routes cannot be created under ${reserved} — that prefix belongs to the platform.`,
    );
  }
  const targetFile = body.targetFile?.trim() || null;
  if (targetFile && (targetFile.includes("..") || targetFile.startsWith("/"))) {
    throw new ApiError("bad_request", "Target file must be a project-relative path.");
  }
  let proxyConfig: string | null = null;
  if (body.isProxy) {
    const raw = body.proxyConfig;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new ApiError("bad_request", "Proxy routes need a proxyConfig object with a target URL.");
    }
    const config = raw as { target?: unknown };
    if (typeof config.target !== "string" || !/^https?:\/\//i.test(config.target)) {
      throw new ApiError("bad_request", "proxyConfig.target must be an http(s) URL.");
    }
    proxyConfig = JSON.stringify(raw);
  }
  if (!body.isProxy && !targetFile) {
    throw new ApiError("bad_request", "Non-proxy routes need a target file.");
  }
  const requiredRole = body.requiredRole?.trim() || null;
  // A route that names a permission is protected by definition: the visitor's
  // role has to actually carry it, so the auth gate applies even when the owner
  // left `requiresAuth` off.
  const requiredPermission = body.requiredPermission || null;
  return { targetFile, proxyConfig, requiredRole, requiredPermission };
}

/** POST /api/routes?projectId=N — create or update the route at pathPattern. */
export const consoleRoutesCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, routeSchema);
  const { targetFile, proxyConfig, requiredRole, requiredPermission } = validateRouteBody(body);

  const db = getDb();
  const p = db.driver;
  const bind = (v: boolean) => (p === "sqlite" ? (v ? 1 : 0) : v);
  const now = new Date().toISOString();

  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM routes
     WHERE project_id = ${placeholder(p, 0)} AND path_pattern = ${placeholder(p, 1)}`,
    [project.id, body.pathPattern],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE routes SET target_file = ${placeholder(p, 0)}, is_proxy = ${placeholder(p, 1)},
         proxy_config = ${placeholder(p, 2)}, requires_auth = ${placeholder(p, 3)},
         required_role = ${placeholder(p, 4)}, required_permission = ${placeholder(p, 5)},
         is_active = ${placeholder(p, 6)}, updated_at = ${placeholder(p, 7)}
       WHERE id = ${placeholder(p, 8)}`,
      [
        targetFile,
        bind(body.isProxy),
        proxyConfig,
        bind(body.requiresAuth),
        requiredRole,
        requiredPermission,
        bind(body.isActive),
        now,
        existing[0].id,
      ],
    );
    return apiOk({ success: true, updated: true });
  }
  await db.run(
    `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, required_permission, is_active)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)}, ${placeholder(p, 6)}, ${placeholder(p, 7)}, ${placeholder(p, 8)})`,
    [
      project.id,
      body.pathPattern,
      targetFile,
      bind(body.isProxy),
      proxyConfig,
      bind(body.requiresAuth),
      requiredRole,
      requiredPermission,
      bind(body.isActive),
    ],
  );
  return apiOk({ success: true, updated: false }, { status: 201 });
});

/** DELETE /api/routes/{id}?projectId=N */
export const consoleRoutesDelete = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const routeId = Number((await context.params).routeId);
  if (!Number.isInteger(routeId) || routeId <= 0) {
    throw new ApiError("bad_request", "Invalid route id.");
  }
  const db = getDb();
  const result = await db.run(
    `DELETE FROM routes WHERE id = ${placeholder(db.driver, 0)} AND project_id = ${placeholder(db.driver, 1)}`,
    [routeId, project.id],
  );
  if (result.changes === 0) throw new ApiError("not_found", "Route not found.");
  return apiOk({ success: true });
});

// ---------------------------------------------------------------- api keys

/** GET /api/keys?projectId=N — metadata only; the plaintext key is shown once. */
export const consoleApiKeysList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, name, prefix, permissions, created_at, revoked_at, last_used_at FROM api_keys
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id`,
    [project.id],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      prefix: String(row.prefix),
      permissions: parsePermissionList(row.permissions),
      createdAt: String(row.created_at ?? ""),
      revokedAt: (row.revoked_at as string | null) ?? null,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
    })),
    availablePermissions: [...PERMISSIONS],
  });
});

function parsePermissionList(raw: unknown): string[] {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Malformed map reads as empty (full access).
  }
  return [];
}

const keyCreateSchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string().min(1).max(64)).max(32).default([]),
});

/** POST /api/keys?projectId=N — returns the full key exactly once. */
export const consoleApiKeysCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, keyCreateSchema);
  const principal = await requireSessionUser(request);
  const { record, key } = await createApiKey(principal.userId!, project.id, body.name, body.permissions);
  return apiOk({ key, record }, { status: 201 });
});

/** DELETE /api/keys/{id}?projectId=N — revoke (the hash stays for audit). */
export const consoleApiKeysRevoke = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const keyId = Number((await context.params).keyId);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    throw new ApiError("bad_request", "Invalid key id.");
  }
  const db = getDb();
  const result = await db.run(
    `UPDATE api_keys SET revoked_at = ${placeholder(db.driver, 0)}
     WHERE id = ${placeholder(db.driver, 1)} AND project_id = ${placeholder(db.driver, 2)} AND revoked_at IS NULL`,
    [new Date().toISOString(), keyId, project.id],
  );
  if (result.changes === 0) throw new ApiError("not_found", "Key not found or already revoked.");
  return apiOk({ success: true });
});

// ---------------------------------------------------------------- visitors

/** GET /api/visitors?projectId=N — visitor accounts with their role names. */
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

const visitorCreateSchema = z.object({
  username: z.string().regex(VISITOR_RE),
  password: z.string().min(8).max(256),
  role: z.string().max(64).optional(),
});

/** POST /api/visitors?projectId=N — create a visitor with an optional role. */
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

const visitorPatchSchema = z.object({
  /** Renaming is supported because a visitor created with a typo was otherwise stuck with it forever. */
  username: z.string().min(3).max(64).regex(/^[a-z0-9_-]+$/).optional(),
  role: z.string().min(1).max(64).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/visitors/{id}?projectId=N — change a visitor's role, rename or
 * suspend them.
 *
 * The role could previously only be chosen at creation time, so promoting
 * somebody was impossible without deleting their account and creating it again
 * — which loses the password and the visitor id their sessions refer to.
 */
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
    // A typo in the role must not silently clear someone's permissions.
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

/** DELETE /api/visitors/{id}?projectId=N */
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

// ---------------------------------------------------------------- roles

/** GET /api/roles?projectId=N */
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

const roleCreateSchema = z.object({
  name: z.string().regex(NAME_RE),
  permissions: z.array(z.string().min(1).max(64)).max(64).default([]),
});

/** POST /api/roles?projectId=N */
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

/** PATCH /api/roles/[roleId]?projectId=N — rename a role or change its grants. */
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

/**
 * What happens to the visitors who hold a role that is about to disappear.
 *
 * `leave_role` is the honest default: `visitors.role_id` is nullable, so a
 * visitor with no role still signs in and simply matches routes that require no
 * particular role. The alternative — silently deleting the people — loses data,
 * and silently keeping the row would point at a role that no longer exists.
 */
export const ROLE_ON_DELETE = ["leave_role", "delete_visitors", "move_to"] as const;
export type RoleOnDelete = (typeof ROLE_ON_DELETE)[number];

/** DELETE /api/roles/[roleId]?projectId=N[&onDelete=…&moveToRoleId=…] */
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

  // Resolve the holders *before* the role row is removed — see the SET NULL note
  // below. Doing it in this order is what makes `delete_visitors` delete
  // anybody at all.
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

  // `leave_role` needs nothing: ON DELETE SET NULL has already cleared role_id
  // for every holder, and the visitors still sign in and still match routes that
  // require no particular role.
  return apiOk({ success: true, visitorsMoved: affected, onDelete });
});

// ---------------------------------------------------------------- visits

/** GET /api/visits/summary?projectId=N — visits logged this calendar month. */
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

// ---------------------------------------------------------------- domains

/** Certificate requests (§5.6) need an ACME contact address and optional SANs. */
const certificateSchema = z.object({
  email: z.string().email().max(254),
  sans: z.array(z.string().max(253)).max(20).optional(),
});

/** GET /api/domains?projectId=N — domains attached to the project. */
export const consoleDomainsList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, domain, verification_token, is_verified, ssl_certificate, ssl_expires_at, created_at
     FROM domains WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id`,
    [project.id],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      domain: String(row.domain),
      verificationToken: String(row.verification_token),
      isVerified: toBool(row.is_verified),
      hasCertificate: Boolean(row.ssl_certificate),
      certificateExpiresAt: (row.ssl_expires_at as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
    ssl: await sslStatus(),
  });
});

/**
 * POST /api/domains/certificate?projectId=N&domain=… — order an ACME
 * certificate for a verified domain (Blueprint §5.6 step 5). Requires
 * `ssl.auto_provision`; with it off the platform refuses rather than reaching
 * out to a CA the operator did not ask for.
 */
export const consoleDomainCertificate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"), "domains_manage");
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!domain) throw new ApiError("bad_request", "domain query parameter is required.");
  const body = await parseJson(request, certificateSchema);
  const certificate = await provisionCertificate(domain, { email: body.email, sans: body.sans });
  logDomainEvent("certificate_issued", { projectId: project.id, domain });
  return apiOk({
    success: true,
    domain: certificate.domain,
    expiresAt: certificate.expiresAt,
  });
});

/** POST /api/domains/renew — re-issue anything inside the renewal window. */
export const consoleDomainsRenew = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"), "domains_manage");
  const body = await parseJson(request, certificateSchema.partial());
  const result = await renewExpiringCertificates({ email: body.email });
  logDomainEvent("certificates_renewed", { projectId: project.id, renewed: result.renewed });
  return apiOk({ success: true, ...result });
});

function logDomainEvent(message: string, fields: Record<string, unknown>): void {
  createLogger("domains").info(message, fields);
}

const domainCreateSchema = z.object({
  domain: z
    .string()
    .max(253)
    .regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i),
});

/**
 * POST /api/domains?projectId=N — attach a custom domain. The returned
 * verification token must be published as a TXT record
 * `_localme-verify.<domain>` before /verify will mark it verified.
 */
export const consoleDomainsCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, domainCreateSchema);
  const domain = body.domain.trim().toLowerCase();
  const db = getDb();
  const verificationToken = `localme-verify=${randomBytes(16).toString("hex")}`;
  try {
    await db.run(
      `INSERT INTO domains (project_id, domain, verification_token) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, ${placeholder(db.driver, 2)})`,
      [project.id, domain, verificationToken],
    );
  } catch (error) {
    if (/UNIQUE constraint failed|duplicate key value/i.test(error instanceof Error ? error.message : String(error))) {
      throw new ApiError("conflict", "That domain is already attached.");
    }
    throw error;
  }
  return apiOk({ success: true, domain, verificationToken, dns: { name: `_localme-verify.${domain}`, type: "TXT", value: verificationToken } }, { status: 201 });
});

/**
 * POST /api/domains/verify?projectId=N — check the TXT record over DNS over
 * HTTPS (1.1.1.1) and flip is_verified when it matches.
 */
export const consoleDomainsVerify = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!domain) throw new ApiError("bad_request", "domain query parameter is required.");
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, verification_token, is_verified FROM domains
     WHERE project_id = ${placeholder(db.driver, 0)} AND domain = ${placeholder(db.driver, 1)}`,
    [project.id, domain],
  );
  const row = rows[0];
  if (!row) throw new ApiError("not_found", "Domain not attached to this project.");
  if (toBool(row.is_verified)) {
    return apiOk({ success: true, verified: true, domain });
  }

  let txtValues: string[] = [];
  try {
    const dnsResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_localme-verify.${encodeURIComponent(domain)}&type=TXT`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(8_000) },
    );
    const dnsJson = (await dnsResponse.json()) as { Answer?: Array<{ type: number; data: string }> };
    txtValues = (dnsJson.Answer ?? [])
      .filter((answer) => answer.type === 16)
      .map((answer) => answer.data.replace(/^"|"$/g, ""));
  } catch {
    // DNS lookup failure means "not verified yet" — the caller can retry.
  }

  const verified = txtValues.includes(String(row.verification_token));
  if (verified) {
    await db.run(
      `UPDATE domains SET is_verified = ${placeholder(db.driver, 0)}, updated_at = ${placeholder(db.driver, 1)} WHERE id = ${placeholder(db.driver, 2)}`,
      [db.driver === "sqlite" ? 1 : true, new Date().toISOString(), Number(row.id)],
    );
  }
  return apiOk({ success: true, verified, domain, dnsRecordsFound: txtValues.length });
});

/** DELETE /api/domains/{id}?projectId=N */
export const consoleDomainsDelete = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const domainId = Number((await context.params).domainId);
  if (!Number.isInteger(domainId) || domainId <= 0) {
    throw new ApiError("bad_request", "Invalid domain id.");
  }
  const db = getDb();
  const result = await db.run(
    `DELETE FROM domains WHERE id = ${placeholder(db.driver, 0)} AND project_id = ${placeholder(db.driver, 1)}`,
    [domainId, project.id],
  );
  if (result.changes === 0) throw new ApiError("not_found", "Domain not found.");
  return apiOk({ success: true });
});

// ---------------------------------------------------------------- endpoints

/** GET /api/endpoints?projectId=N — named API policy rows (api_endpoints). */
export const consoleEndpointsList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT endpoint_name, is_enabled, requires_auth FROM api_endpoints
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY endpoint_name`,
    [project.id],
  );
  const configured = new Map(
    rows.map((row) => [String(row.endpoint_name), row]),
  );
  // Every named endpoint is listed, with defaults where no row exists yet.
  const data = DB_ENDPOINTS.map((endpoint) => {
    const row = configured.get(endpoint);
    return {
      endpoint,
      isEnabled: row ? toBool(row.is_enabled) : true,
      requiresAuth: row ? toBool(row.requires_auth) : true,
    };
  });
  return apiOk({ data, available: [...DB_ENDPOINTS] });
});

const endpointToggleSchema = z.object({
  endpoint: z.string().regex(/^[a-z]+\.[a-z]+$/),
  isEnabled: z.boolean().optional(),
  requiresAuth: z.boolean().optional(),
});

/**
 * PUT /api/endpoints?projectId=N — set a named endpoint's policy. `isEnabled`
 * turns the endpoint off entirely (403); `requiresAuth: false` opens it to
 * anonymous, project-scoped calls (§5.4 "set authorization rules per endpoint").
 */
export const consoleEndpointsToggle = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, endpointToggleSchema);
  if (body.isEnabled === undefined && body.requiresAuth === undefined) {
    throw new ApiError("bad_request", "Provide isEnabled and/or requiresAuth.");
  }
  const db = getDb();
  const p = db.driver;
  const existing = await db.raw<{ id: number; is_enabled: number | boolean; requires_auth: number | boolean }>(
    `SELECT id, is_enabled, requires_auth FROM api_endpoints WHERE project_id = ${placeholder(p, 0)} AND endpoint_name = ${placeholder(p, 1)}`,
    [project.id, body.endpoint],
  );
  const enabled = body.isEnabled ?? (existing[0] ? toBool(existing[0].is_enabled) : true);
  const requiresAuth = body.requiresAuth ?? (existing[0] ? toBool(existing[0].requires_auth) : true);
  const enabledValue = p === "sqlite" ? (enabled ? 1 : 0) : enabled;
  const authValue = p === "sqlite" ? (requiresAuth ? 1 : 0) : requiresAuth;

  if (existing[0]) {
    await db.run(
      `UPDATE api_endpoints SET is_enabled = ${placeholder(p, 0)}, requires_auth = ${placeholder(p, 1)}, updated_at = ${placeholder(p, 2)} WHERE id = ${placeholder(p, 3)}`,
      [enabledValue, authValue, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO api_endpoints (project_id, endpoint_name, is_enabled, requires_auth) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [project.id, body.endpoint, enabledValue, authValue],
    );
  }
  return apiOk({ success: true, endpoint: body.endpoint, isEnabled: enabled, requiresAuth });
});

// ---------------------------------------------------------------- usage

/** GET /api/usage?projectId=N — daily visit stats + monthly quota snapshot. */
export const consoleUsage = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const daily = await db.raw<Record<string, unknown>>(
    `SELECT date, total_visits, unique_visitors FROM daily_project_stats
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY date DESC LIMIT 30`,
    [project.id],
  );
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const month = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visit_logs
     WHERE project_id = ${placeholder(db.driver, 0)} AND visited_at >= ${placeholder(db.driver, 1)}`,
    [project.id, monthStart],
  );
  const storageUsed = await storageUsedBytes(project.userId);
  return apiOk({
    data: daily.map((row) => ({
      date: String(row.date),
      visits: Number(row.total_visits ?? 0),
      uniqueVisitors: Number(row.unique_visitors ?? 0),
    })),
    thisMonth: Number(month[0]?.n ?? 0),
    freeVisitsPerMonth: project.freeVisitsPerMonth,
    storageUsed,
  });
});

// ---------------------------------------------------------------- backup

/** GET /api/storage/export?projectId=N — the whole project as a ZIP archive. */
export const consoleStorageExport = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const files = await listFiles(project.id, "");
  const entries = [];
  for (const file of files) {
    const found = await getFileBlob(project.id, file.path);
    if (found) {
      entries.push({ path: file.path, content: found.content });
    }
  }
  const zip = buildZip(entries);
  const body = new Uint8Array(zip);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project.name}-backup.zip"`,
    },
  }) as unknown as import("next/server").NextResponse;
});

// ---------------------------------------------------------------- tables

/** GET /api/db/tables?projectId=N — document-store tables with row counts. */
export const consoleTablesList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<{ table_name: string; count: string | number }>(
    `SELECT table_name, COUNT(*) AS count FROM project_data
     WHERE project_id = ${placeholder(db.driver, 0)}
     GROUP BY table_name ORDER BY table_name`,
    [project.id],
  );
  return apiOk({ data: rows.map((r) => ({ name: r.table_name, count: Number(r.count) })) });
});

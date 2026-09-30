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
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { createApiKey, requireOwnedProject, type ProjectRecord } from "@/lib/server/repos";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { hashVisitorPassword } from "@/lib/server/visitor-auth";

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
const VISITOR_RE = /^[a-z0-9_-]{3,32}$/;

async function scopedProject(request: Request, projectIdParam: string | null): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
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
    isActive: toBool(row.is_active),
  };
}

const ROUTE_COLUMNS =
  "id, project_id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, is_active";

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
  isActive: z.boolean().default(true),
});

function validateRouteBody(body: z.infer<typeof routeSchema>): {
  targetFile: string | null;
  proxyConfig: string | null;
  requiredRole: string | null;
} {
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
  return { targetFile, proxyConfig, requiredRole };
}

/** POST /api/routes?projectId=N — create or update the route at pathPattern. */
export const consoleRoutesCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, routeSchema);
  const { targetFile, proxyConfig, requiredRole } = validateRouteBody(body);

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
         required_role = ${placeholder(p, 4)}, is_active = ${placeholder(p, 5)}, updated_at = ${placeholder(p, 6)}
       WHERE id = ${placeholder(p, 7)}`,
      [targetFile, bind(body.isProxy), proxyConfig, bind(body.requiresAuth), requiredRole, bind(body.isActive), now, existing[0].id],
    );
    return apiOk({ success: true, updated: true });
  }
  await db.run(
    `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, is_active)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)}, ${placeholder(p, 6)}, ${placeholder(p, 7)})`,
    [project.id, body.pathPattern, targetFile, bind(body.isProxy), proxyConfig, bind(body.requiresAuth), requiredRole, bind(body.isActive)],
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
    `SELECT id, name, prefix, created_at, revoked_at, last_used_at FROM api_keys
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id`,
    [project.id],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      prefix: String(row.prefix),
      createdAt: String(row.created_at ?? ""),
      revokedAt: (row.revoked_at as string | null) ?? null,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
    })),
  });
});

const keyCreateSchema = z.object({ name: z.string().min(1).max(64) });

/** POST /api/keys?projectId=N — returns the full key exactly once. */
export const consoleApiKeysCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, keyCreateSchema);
  const principal = await requireSessionUser(request);
  const { record, key } = await createApiKey(principal.userId!, project.id, body.name);
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

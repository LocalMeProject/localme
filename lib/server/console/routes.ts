import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { PERMISSIONS } from "@/lib/server/repos";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { scopedProject, toBool } from "./common";

export interface ConsoleRoute {
  id: number;
  projectId: number;
  pathPattern: string;
  targetFile: string | null;
  isProxy: boolean;
  requiresAuth: boolean;
  requiredRole: string | null;
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

export const routeSchema = z.object({
  pathPattern: z.string().regex(/^\/.{0,255}$/),
  targetFile: z.string().max(512).optional().nullable(),
  isProxy: z.boolean().default(false),
  proxyConfig: z.unknown().optional(),
  requiresAuth: z.boolean().default(false),
  requiredRole: z.string().max(64).optional().nullable(),
  requiredPermission: z.enum(PERMISSIONS).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const RESERVED_ROUTE_PREFIXES = [
  "/api",
  "/auth",
  "/admin",
  "/dashboard",
  "/library",
  "/~public",
  "/_next",
  "/docs",
  "/health",
];

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
  const requiredPermission = body.requiredPermission || null;
  return { targetFile, proxyConfig, requiredRole, requiredPermission };
}

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

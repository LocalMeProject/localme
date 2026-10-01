/**
 * Shared logic for /api/db/{find,get,count,insert,update,delete} — document
 * operations on the caller's project (Blueprint §5.1, §6.2, Tech docs §13.1).
 *
 * Authorization follows §5.5/§6.2: console sessions own their projects, API keys
 * carry granular permissions (`db_read` / `db_write`), and each endpoint honors
 * the project's `api_endpoints` row — `is_enabled` (403 when off) and
 * `requires_auth` (false opens the endpoint to anonymous, project-scoped calls,
 * which is how you build public forms and read APIs).
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePermission, resolvePrincipal, type Principal } from "@/lib/server/api-auth";
import { createDocumentStore, DuplicateDocumentIdError } from "@/lib/server/db/documents";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { getProjectById, requireOwnedProject, type ProjectRecord } from "@/lib/server/repos";
import { dispatchWebhookEvent } from "@/lib/server/webhook-routes";

const tableName = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/);

const findSchema = z.object({
  table: tableName,
  filter: z.record(z.string(), z.unknown()).optional(),
  sort: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
});

const getSchema = z.object({
  table: tableName,
  id: z.union([z.string().max(256), z.number()]),
});

const countSchema = z.object({
  table: tableName,
  filter: z.record(z.string(), z.unknown()).optional(),
});

const insertSchema = z.object({
  table: tableName,
  document: z.record(z.string(), z.unknown()),
});

const updateSchema = z.object({
  table: tableName,
  filter: z.record(z.string(), z.unknown()).optional(),
  update: z.record(z.string(), z.unknown()),
  many: z.boolean().default(false),
});

const deleteSchema = z.object({
  table: tableName,
  filter: z.record(z.string(), z.unknown()).optional(),
});

/** Endpoint names mirror the Blueprint's api_endpoints registry. */
export const DB_ENDPOINTS = ["db.find", "db.get", "db.count", "db.insert", "db.update", "db.delete"] as const;
type EndpointName = (typeof DB_ENDPOINTS)[number];

interface EndpointPolicy {
  disabled: boolean;
  requiresAuth: boolean;
}

async function endpointPolicy(projectId: number, endpoint: EndpointName): Promise<EndpointPolicy> {
  const db = getDb();
  const rows = await db.raw<{ is_enabled: number | boolean; requires_auth: number | boolean }>(
    `SELECT is_enabled, requires_auth FROM api_endpoints
     WHERE project_id = ${placeholder(db.driver, 0)} AND endpoint_name = ${placeholder(db.driver, 1)}`,
    [projectId, endpoint],
  );
  const row = rows[0];
  if (!row) return { disabled: false, requiresAuth: true };
  return {
    disabled: !(row.is_enabled === 1 || row.is_enabled === true),
    requiresAuth: !(row.requires_auth === 0 || row.requires_auth === false),
  };
}

/**
 * Resolve the project a document call targets, applying the endpoint policy and
 * the granular permission for the operation.
 */
async function scopedStore(
  request: Request,
  endpoint: EndpointName,
  permission: "db_read" | "db_write",
): Promise<{ store: ReturnType<typeof createDocumentStore>; projectId: number; principal: Principal | null }> {
  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId") ?? request.headers.get("x-project-id");
  // A visitor's cookie is named `auth_{projectId}`, so the target project has to
  // be known before the caller can be resolved. The hint comes from the request
  // itself; a bad value simply fails to match a cookie and stays anonymous.
  const projectIdHint = /^\d+$/.test(projectIdParam ?? "") ? Number(projectIdParam) : null;
  const principal = await resolvePrincipal(request, projectIdHint);

  let project: ProjectRecord | null;
  if (principal?.kind === "api_key") {
    project = await getProjectById(principal.projectId!);
    if (!project) throw new ApiError("not_found", "Project not found.");
  } else if (principal?.kind === "visitor") {
    // The visitor is pinned to the project its token was issued for, whatever
    // projectId the request named.
    if (projectIdHint != null && projectIdHint !== principal.projectId) {
      throw new ApiError("forbidden", "This visitor session is scoped to another project.");
    }
    project = await getProjectById(principal.projectId!);
    if (!project) throw new ApiError("not_found", "Project not found.");
  } else if (principal) {
    project = await requireOwnedProject(principal.userId!, parseProjectId(projectIdParam));
  } else {
    // Anonymous callers may only reach endpoints explicitly opened by the owner.
    if (!projectIdParam) throw new ApiError("unauthorized", "Sign in or present a valid API key.");
    project = await getProjectById(parseProjectId(projectIdParam));
    if (!project) throw new ApiError("not_found", "Project not found.");
  }

  if (!project.isActive) throw new ApiError("forbidden", "Project is suspended.");

  const policy = await endpointPolicy(project.id, endpoint);
  if (policy.disabled) {
    throw new ApiError("forbidden", `The ${endpoint} endpoint is disabled for this project.`);
  }
  if (policy.requiresAuth) {
    if (!principal) throw new ApiError("unauthorized", "Sign in or present a valid API key.");
    requirePermission(principal, permission);
  }

  return { store: createDocumentStore(getDb()), projectId: project.id, principal };
}

function parseProjectId(raw: string | null): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  return id;
}

export const dbFind = handler(async (request) => {
  const body = await parseJson(request, findSchema);
  const { store, projectId } = await scopedStore(request, "db.find", "db_read");
  // `find` already reports a scan-capped `total`, so this is one round trip
  // rather than a second, uncapped COUNT over the whole table.
  return apiOk(await store.find(projectId, body.table, body));
});

/** POST /api/db/get — fetch one document by its id. */
export const dbGet = handler(async (request) => {
  const body = await parseJson(request, getSchema);
  const { store, projectId } = await scopedStore(request, "db.get", "db_read");
  const row = await store.get(projectId, body.table, body.id);
  if (!row) throw new ApiError("not_found", "Document not found.");
  const document = row.document as Record<string, unknown>;
  return apiOk({ data: { ...document, _localme: { created: row.created_at, updated: row.updated_at } } });
});

/** POST /api/db/count — count documents matching a filter. */
export const dbCount = handler(async (request) => {
  const body = await parseJson(request, countSchema);
  const { store, projectId } = await scopedStore(request, "db.count", "db_read");
  const count = await store.count(projectId, body.table, body.filter);
  return apiOk({ total: count });
});

export const dbInsert = handler(async (request) => {
  const body = await parseJson(request, insertSchema);
  const { store, projectId } = await scopedStore(request, "db.insert", "db_write");
  try {
    const row = await store.insert(projectId, body.table, body.document as Record<string, never>);
    void dispatchWebhookEvent(projectId, "document.created", {
      table: body.table,
      id: (row.document as { id?: unknown }).id ?? null,
      document: row.document,
    }).catch(() => undefined);
    return apiOk({ success: true, id: (row.document as { id?: unknown }).id ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateDocumentIdError) {
      throw new ApiError("conflict", error.message);
    }
    throw error;
  }
});

export const dbUpdate = handler(async (request) => {
  const body = await parseJson(request, updateSchema);
  const { store, projectId } = await scopedStore(request, "db.update", "db_write");
  const modified = await store.update(projectId, body.table, body.filter, body.update, body.many);
  if (modified > 0) {
    void dispatchWebhookEvent(projectId, "document.updated", {
      table: body.table,
      filter: body.filter ?? {},
      modified,
    }).catch(() => undefined);
  }
  return apiOk({ success: true, modified });
});

export const dbDelete = handler(async (request) => {
  const body = await parseJson(request, deleteSchema);
  const { store, projectId } = await scopedStore(request, "db.delete", "db_write");
  const deleted = await store.delete(projectId, body.table, body.filter);
  if (deleted > 0) {
    void dispatchWebhookEvent(projectId, "document.deleted", {
      table: body.table,
      filter: body.filter ?? {},
      deleted,
    }).catch(() => undefined);
  }
  return apiOk({ success: true, deleted });
});

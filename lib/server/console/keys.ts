import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { createApiKey, PERMISSIONS } from "@/lib/server/repos";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { scopedProject, parsePermissionList } from "./common";

export { parsePermissionList };

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

export const keyCreateSchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string().min(1).max(64)).max(32).default([]),
});

export const consoleApiKeysCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, keyCreateSchema);
  const principal = await requireSessionUser(request);
  const { record, key } = await createApiKey(principal.userId!, project.id, body.name, body.permissions);
  return apiOk({ key, record }, { status: 201 });
});

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

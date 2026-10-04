/**
 * Reading items for selective configuration transfer.
 */
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  TRANSFER_FEATURES,
  type TransferFeature,
  type TransferItem,
  bool,
  log,
  normalizePath,
  ownedProject,
  parseArray,
} from "./common";

export async function readAll(projectId: number, feature: TransferFeature): Promise<TransferItem[]> {
  const db = getDb();
  const p = db.driver;
  const scoped = `project_id = ${placeholder(p, 0)}`;

  switch (feature) {
    case "routes": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role,
                required_permission, is_active
         FROM routes WHERE ${scoped} ORDER BY path_pattern`,
        [projectId],
      );
      return rows.map((row) => ({
        id: String(row.path_pattern),
        data: {
          pathPattern: normalizePath(String(row.path_pattern)),
          targetFile: (row.target_file as string | null) ?? null,
          isProxy: bool(row.is_proxy),
          proxyConfig: row.proxy_config ? JSON.parse(String(row.proxy_config)) : null,
          requiresAuth: bool(row.requires_auth),
          requiredRole: (row.required_role as string | null) ?? null,
          requiredPermission: (row.required_permission as string | null) ?? null,
          isActive: bool(row.is_active),
        },
      }));
    }
    case "secrets": {
      // Values are never transferred (§5.10) — importing a name-only item is a
      // no-op that keeps whatever the destination already holds.
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT key_name, updated_at FROM secrets WHERE ${scoped} ORDER BY key_name`,
        [projectId],
      );
      return rows.map((row) => ({
        id: String(row.key_name),
        data: { key: String(row.key_name), updatedAt: String(row.updated_at ?? "") },
      }));
    }
    case "auth": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT v.username, v.is_active, COALESCE(r.name, 'Member') AS role
          FROM visitors v LEFT JOIN roles r ON r.id = v.role_id
          WHERE v.${scoped} ORDER BY v.username`,
        [projectId],
      );
      return rows.map((row) => ({
        id: String(row.username),
        data: {
          username: String(row.username),
          role: String(row.role),
          isActive: bool(row.is_active),
        },
      }));
    }
    case "roles": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT name, permissions FROM roles WHERE ${scoped} ORDER BY name`,
        [projectId],
      );
      return rows.map((row) => ({
        id: String(row.name),
        data: { name: String(row.name), permissions: parseArray(row.permissions) },
      }));
    }
  }
}

/**
 * GET /api/transfer?projectId=N&feature=…[&ids=…]
 * Selective export. `ids` is comma-separated; omitting it exports everything.
 */
export const transferExport = handler(async (request) => {
  const url = new URL(request.url);
  const project = await ownedProject(request, url.searchParams.get("projectId"));
  const feature = url.searchParams.get("feature") as TransferFeature | null;
  if (!feature || !(TRANSFER_FEATURES as readonly string[]).includes(feature)) {
    throw new ApiError("bad_request", `feature must be one of ${TRANSFER_FEATURES.join(", ")}.`);
  }
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  let items = await readAll(project.id, feature);
  if (ids.length > 0) {
    const wanted = new Set(ids);
    items = items.filter((item) => wanted.has(item.id));
    if (items.length === 0) {
      throw new ApiError("bad_request", "None of the selected items exist in this project.");
    }
  }
  log.info("transfer.export", { projectId: project.id, feature, count: items.length });
  return apiOk({ feature, items: items.map((item) => item.data), ids: items.map((item) => item.id) });
});

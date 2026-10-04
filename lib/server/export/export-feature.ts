/**
 * Per-feature configuration export logic (§5.10).
 */
import { ApiError } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { EXPORT_FEATURES, type ExportFeature, bool } from "./common";

export function safeJson(raw: unknown, fallback: unknown): unknown {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw ?? fallback;
  } catch {
    return fallback;
  }
}

export function parseArray(raw: unknown): string[] {
  const parsed = safeJson(raw, []);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
}

/** Export one configuration feature as JSON (§5.10 per-feature export). */
export async function exportFeature(projectId: number, feature: ExportFeature): Promise<unknown> {
  const db = getDb();
  const p = db.driver;
  const project = `project_id = ${placeholder(p, 0)}`;

  switch (feature) {
    case "routes": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, is_active FROM routes WHERE ${project} ORDER BY path_pattern`,
        [projectId],
      );
      return rows.map((row) => ({
        pathPattern: String(row.path_pattern),
        targetFile: (row.target_file as string | null) ?? null,
        isProxy: bool(row.is_proxy),
        proxyConfig: row.proxy_config ? JSON.parse(String(row.proxy_config)) : null,
        requiresAuth: bool(row.requires_auth),
        requiredRole: (row.required_role as string | null) ?? null,
        isActive: bool(row.is_active),
      }));
    }
    case "api": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT endpoint_name, is_enabled, requires_auth FROM api_endpoints WHERE ${project} ORDER BY endpoint_name`,
        [projectId],
      );
      return rows.map((row) => ({
        endpoint: String(row.endpoint_name),
        isEnabled: bool(row.is_enabled),
        requiresAuth: bool(row.requires_auth),
      }));
    }
    case "roles": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT name, permissions FROM roles WHERE ${project} ORDER BY name`,
        [projectId],
      );
      return rows.map((row) => ({
        name: String(row.name),
        permissions: parseArray(row.permissions),
      }));
    }
    case "secrets": {
      // Values are never exported per feature (§5.10).
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT key_name, created_at, updated_at FROM secrets WHERE ${project} ORDER BY key_name`,
        [projectId],
      );
      return rows.map((row) => ({
        key: String(row.key_name),
        createdAt: String(row.created_at ?? ""),
        updatedAt: String(row.updated_at ?? ""),
      }));
    }
    case "cron": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT task_name, is_enabled, parameters FROM cron_configs WHERE ${project} ORDER BY task_name`,
        [projectId],
      );
      return rows.map((row) => ({
        task: String(row.task_name),
        isEnabled: bool(row.is_enabled),
        parameters: safeJson(row.parameters, {}),
      }));
    }
    case "webhooks": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT url, events, is_active FROM webhooks WHERE ${project} ORDER BY id`,
        [projectId],
      );
      return rows.map((row) => ({
        url: String(row.url),
        events: parseArray(row.events),
        isActive: bool(row.is_active),
      }));
    }
    case "dns": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT domain, verification_token, is_verified FROM domains WHERE ${project} ORDER BY domain`,
        [projectId],
      );
      return rows.map((row) => ({
        domain: String(row.domain),
        verificationToken: String(row.verification_token),
        isVerified: bool(row.is_verified),
      }));
    }
    case "auth": {
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT v.username, v.is_active, r.name AS role_name
         FROM visitors v LEFT JOIN roles r ON r.id = v.role_id
         WHERE v.project_id = ${placeholder(p, 0)} ORDER BY v.username`,
        [projectId],
      );
      return {
        visitors: rows.map((row) => ({
          username: String(row.username),
          role: (row.role_name as string | null) ?? "Member",
          isActive: bool(row.is_active),
        })),
      };
    }
    default:
      throw new ApiError("bad_request", `Unknown export feature. Known: ${EXPORT_FEATURES.join(", ")}`);
  }
}

/** Full project config bundle used by the all-export (§5.10 config.json). */
export async function exportConfigBundle(projectId: number): Promise<Record<string, unknown>> {
  const bundle: Record<string, unknown> = {};
  for (const feature of EXPORT_FEATURES) {
    bundle[feature] = await exportFeature(projectId, feature);
  }
  return bundle;
}

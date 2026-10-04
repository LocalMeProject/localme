/**
 * Per-feature configuration import logic (§5.10).
 */
import { z } from "zod";
import { ApiError } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder, quote } from "@/lib/server/db/sql";
import { encryptSecret } from "@/lib/server/secrets-crypto";
import { EXPORT_FEATURES, type ExportFeature, bind, UNMATCHABLE_PASSWORD_HASH } from "./common";

export const routesSchema = z.array(
  z.object({
    pathPattern: z.string().min(1).max(256),
    targetFile: z.string().max(512).nullable().optional(),
    isProxy: z.boolean().default(false),
    proxyConfig: z.unknown().optional(),
    requiresAuth: z.boolean().default(false),
    requiredRole: z.string().max(64).nullable().optional(),
    isActive: z.boolean().default(true),
  }),
);

export const apiSchema = z.array(
  z.object({
    endpoint: z.string().min(3).max(64),
    isEnabled: z.boolean().default(true),
    requiresAuth: z.boolean().default(true),
  }),
);

export const rolesSchema = z.array(
  z.object({
    name: z.string().min(1).max(64),
    permissions: z.array(z.string().min(1).max(64)).default([]),
  }),
);

export const secretsSchema = z.array(
  z.object({
    key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
    value: z.string().max(64_000).optional(),
  }),
);

export const cronSchema = z.array(
  z.object({
    task: z.string().min(1).max(64),
    isEnabled: z.boolean().default(true),
    parameters: z.record(z.string(), z.unknown()).default({}),
  }),
);

export const webhooksSchema = z.array(
  z.object({
    url: z.string().url().max(2048),
    events: z.array(z.string().min(1).max(64)).default([]),
    isActive: z.boolean().default(true),
    secret: z.string().max(256).nullable().optional(),
  }),
);

export const dnsSchema = z.array(
  z.object({
    domain: z.string().min(3).max(253),
    verificationToken: z.string().min(1).max(256).optional(),
    isVerified: z.boolean().default(false),
  }),
);

export const authSchema = z.object({
  visitors: z
    .array(
      z.object({
        username: z.string().min(1).max(64),
        role: z.string().max(64).default("Member"),
        isActive: z.boolean().default(true),
      }),
    )
    .default([]),
});

async function replaceRows(
  projectId: number,
  table: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  const db = getDb();
  const p = db.driver;
  await db.run(`DELETE FROM ${quote.ident(table)} WHERE project_id = ${placeholder(p, 0)}`, [projectId]);
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = values.map((_, i) => placeholder(p, i)).join(", ");
    await db.run(
      `INSERT INTO ${quote.ident(table)} (${columns.map((c) => quote.ident(c)).join(", ")}) VALUES (${placeholders})`,
      values,
    );
  }
}

/** Import one feature, overwriting existing configuration (§5.10). */
export async function importFeature(
  projectId: number,
  feature: ExportFeature,
  payload: unknown,
): Promise<{ imported: number }> {
  const db = getDb();
  const p = db.driver;
  const now = new Date().toISOString();

  switch (feature) {
    case "routes": {
      const rows = routesSchema.parse(payload);
      await replaceRows(
        projectId,
        "routes",
        rows.map((row) => ({
          project_id: projectId,
          path_pattern: row.pathPattern,
          target_file: row.targetFile ?? null,
          is_proxy: bind(row.isProxy),
          proxy_config: row.proxyConfig ? JSON.stringify(row.proxyConfig) : null,
          requires_auth: bind(row.requiresAuth),
          required_role: row.requiredRole ?? null,
          is_active: bind(row.isActive),
        })),
      );
      return { imported: rows.length };
    }
    case "api": {
      const rows = apiSchema.parse(payload);
      await replaceRows(
        projectId,
        "api_endpoints",
        rows.map((row) => ({
          project_id: projectId,
          endpoint_name: row.endpoint,
          is_enabled: bind(row.isEnabled),
          requires_auth: bind(row.requiresAuth),
        })),
      );
      return { imported: rows.length };
    }
    case "roles": {
      const rows = rolesSchema.parse(payload);
      await replaceRows(
        projectId,
        "roles",
        rows.map((row) => ({
          project_id: projectId,
          name: row.name,
          permissions: JSON.stringify(row.permissions),
        })),
      );
      return { imported: rows.length };
    }
    case "secrets": {
      const rows = secretsSchema.parse(payload);
      let imported = 0;
      for (const row of rows) {
        if (row.value === undefined) continue; // redacted export — keep as-is
        const existing = await db.raw<{ id: number }>(
          `SELECT id FROM secrets WHERE project_id = ${placeholder(p, 0)} AND key_name = ${placeholder(p, 1)}`,
          [projectId, row.key],
        );
        const sealed = await encryptSecret(row.value);
        if (existing[0]) {
          await db.run(
            `UPDATE secrets SET encrypted_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
            [sealed, now, existing[0].id],
          );
        } else {
          await db.run(
            `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
            [projectId, row.key, sealed],
          );
        }
        imported += 1;
      }
      return { imported };
    }
    case "cron": {
      const rows = cronSchema.parse(payload);
      await replaceRows(
        projectId,
        "cron_configs",
        rows.map((row) => ({
          project_id: projectId,
          task_name: row.task,
          is_enabled: bind(row.isEnabled),
          parameters: JSON.stringify(row.parameters ?? {}),
        })),
      );
      return { imported: rows.length };
    }
    case "webhooks": {
      const rows = webhooksSchema.parse(payload);
      await replaceRows(
        projectId,
        "webhooks",
        rows.map((row) => ({
          project_id: projectId,
          url: row.url,
          events: JSON.stringify(row.events),
          is_active: bind(row.isActive),
          secret: row.secret ?? `whsec_${crypto.randomUUID().replace(/-/g, "")}`,
        })),
      );
      return { imported: rows.length };
    }
    case "dns": {
      const rows = dnsSchema.parse(payload);
      await replaceRows(
        projectId,
        "domains",
        rows.map((row) => ({
          project_id: projectId,
          domain: row.domain.toLowerCase(),
          verification_token: row.verificationToken ?? `localme-verify=${crypto.randomUUID().replace(/-/g, "")}`,
          is_verified: bind(row.isVerified),
        })),
      );
      return { imported: rows.length };
    }
    case "auth": {
      const parsed = authSchema.parse(payload);
      const roles = await db.raw<{ id: number; name: string }>(
        `SELECT id, name FROM roles WHERE project_id = ${placeholder(p, 0)}`,
        [projectId],
      );
      const roleId = new Map(roles.map((role) => [role.name, Number(role.id)]));
      const existing = await db.raw<{ id: number; username: string }>(
        `SELECT id, username FROM visitors WHERE project_id = ${placeholder(p, 0)}`,
        [projectId],
      );
      const byName = new Map(existing.map((row) => [String(row.username), Number(row.id)]));

      for (const row of existing) {
        if (!parsed.visitors.some((visitor) => visitor.username === String(row.username))) {
          await db.run(`DELETE FROM visitors WHERE id = ${placeholder(p, 0)}`, [Number(row.id)]);
        }
      }
      for (const visitor of parsed.visitors) {
        const role = roleId.get(visitor.role) ?? null;
        const id = byName.get(visitor.username);
        if (id) {
          // Keep the existing credential; only the role/flag is restored.
          await db.run(
            `UPDATE visitors SET role_id = ${placeholder(p, 0)}, is_active = ${placeholder(p, 1)}, updated_at = ${placeholder(p, 2)} WHERE id = ${placeholder(p, 3)}`,
            [role, bind(visitor.isActive), now, id],
          );
        } else {
          // Password hashes are never exported, so a restored visitor starts
          // disabled with an unmatchable hash until the owner re-invites them.
          await db.run(
            `INSERT INTO visitors (project_id, username, password_hash, role_id, is_active)
             VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})`,
            [projectId, visitor.username, UNMATCHABLE_PASSWORD_HASH, role, bind(false)],
          );
        }
      }
      return { imported: parsed.visitors.length };
    }
    default:
      throw new ApiError("bad_request", `Unknown import feature. Known: ${EXPORT_FEATURES.join(", ")}`);
  }
}

export function featureFromParam(raw: string): ExportFeature {
  if ((EXPORT_FEATURES as readonly string[]).includes(raw)) return raw as ExportFeature;
  throw new ApiError("bad_request", `Unknown feature "${raw}". Known: ${EXPORT_FEATURES.join(", ")}`);
}

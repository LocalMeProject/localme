/**
 * Import/Export service (Blueprint §5.10, Technical Documentation §11).
 *
 * Export:
 *   GET /api/export/{feature} → JSON for routes | api | roles | secrets | cron |
 *                               webhooks | dns | auth (secrets: names only)
 *   GET /api/export/all       → ZIP: lib/, storage/, config/secrets.json (clear
 *                               text, the owner's full backup), config/config.json
 * Import:
 *   POST /api/import/{feature} → JSON, validated, overwrites that feature
 *   POST /api/import/all       → ZIP, validated, applied
 *
 * Everything is owner-only (§5.10 "Only accessible to project Owner").
 */
import { z } from "zod";
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requireOwnedProject, putFile, getFileBlob, getUserById, listFiles, type ProjectRecord } from "@/lib/server/repos";
import { buildZip, readZip } from "@/lib/server/zip";
import { getDb } from "@/lib/server/db/index";
import { placeholder, quote } from "@/lib/server/db/sql";
import { encryptSecret } from "@/lib/server/secrets-crypto";

export const EXPORT_FEATURES = [
  "routes",
  "api",
  "roles",
  "secrets",
  "cron",
  "webhooks",
  "dns",
  "auth",
] as const;

export type ExportFeature = (typeof EXPORT_FEATURES)[number];

function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

/**
 * A well-formed scrypt hash that no password can produce: restored visitors are
 * created disabled and must be re-invited (hashes are deliberately never
 * exported), but the row still validates without throwing.
 */
const UNMATCHABLE_PASSWORD_HASH = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;

function bind(value: boolean): number | boolean {
  return getDb().driver === "sqlite" ? (value ? 1 : 0) : value;
}

async function ownerProject(request: Request, explicitId: number): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  return requireOwnedProject(principal.userId!, explicitId);
}

// ---------------------------------------------------------------- export

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

function parseArray(raw: unknown): string[] {
  const parsed = safeJson(raw, []);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
}

function safeJson(raw: unknown, fallback: unknown): unknown {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw ?? fallback;
  } catch {
    return fallback;
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

/** Full-project ZIP export (§5.10 /api/export/all). */
export async function buildProjectExport(projectId: number, projectName: string): Promise<Buffer> {
  const db = getDb();
  const p = db.driver;
  const files = await listFiles(projectId, "");
  const entries: Array<{ path: string; content: Buffer }> = [];

  for (const file of files) {
    const found = await getFileBlob(projectId, file.path);
    if (!found) continue;
    if (file.path.startsWith("library/")) {
      entries.push({ path: `lib/${file.path.slice("library/".length)}`, content: found.content });
    } else {
      entries.push({ path: `storage/${file.path}`, content: found.content });
    }
  }

  // Clear-text secrets: this is the owner's complete backup (§5.10).
  const secretRows = await db.raw<{ key_name: string; encrypted_value: string }>(
    `SELECT key_name, encrypted_value FROM secrets WHERE project_id = ${placeholder(p, 0)} ORDER BY key_name`,
    [projectId],
  );
  const { decryptSecret } = await import("@/lib/server/secrets-crypto");
  const secrets = await Promise.all(
    secretRows.map(async (row) => {
      try {
        return { key: row.key_name, value: await decryptSecret(row.encrypted_value) };
      } catch {
        // A secret sealed under a different key cannot be read back. Export it
        // with an empty value rather than failing the whole backup.
        return { key: row.key_name, value: "" };
      }
    }),
  );

  // Webhook signing secrets are part of the config bundle in the full export.
  const webhookRows = await db.raw<Record<string, unknown>>(
    `SELECT url, events, is_active, secret FROM webhooks WHERE project_id = ${placeholder(p, 0)} ORDER BY id`,
    [projectId],
  );
  const config = await exportConfigBundle(projectId);
  config.webhooks = webhookRows.map((row) => ({
    url: String(row.url),
    events: parseArray(row.events),
    isActive: bool(row.is_active),
    secret: (row.secret as string | null) ?? null,
  }));

  entries.push({ path: "config/secrets.json", content: Buffer.from(`${JSON.stringify(secrets, null, 2)}\n`, "utf8") });
  entries.push({ path: "config/config.json", content: Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8") });
  entries.push({
    path: "README.txt",
    content: Buffer.from(
      `LocalMe backup of project "${projectName}" (id ${projectId}).\n\nstorage/  project files\nlib/      library assets\nconfig/config.json    routes, api, roles, cron, webhooks, dns, auth\nconfig/secrets.json   secret values in clear text — keep this archive private\n\nRestore with: POST /api/import/all (multipart field "file").\n`,
      "utf8",
    ),
  });

  return buildZip(entries);
}

// ---------------------------------------------------------------- import

const routesSchema = z.array(
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

const apiSchema = z.array(
  z.object({
    endpoint: z.string().min(3).max(64),
    isEnabled: z.boolean().default(true),
    requiresAuth: z.boolean().default(true),
  }),
);

const rolesSchema = z.array(
  z.object({
    name: z.string().min(1).max(64),
    permissions: z.array(z.string().min(1).max(64)).default([]),
  }),
);

const secretsSchema = z.array(
  z.object({
    key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
    value: z.string().max(64_000).optional(),
  }),
);

const cronSchema = z.array(
  z.object({
    task: z.string().min(1).max(64),
    isEnabled: z.boolean().default(true),
    parameters: z.record(z.string(), z.unknown()).default({}),
  }),
);

const webhooksSchema = z.array(
  z.object({
    url: z.string().url().max(2048),
    events: z.array(z.string().min(1).max(64)).default([]),
    isActive: z.boolean().default(true),
    secret: z.string().max(256).nullable().optional(),
  }),
);

const dnsSchema = z.array(
  z.object({
    domain: z.string().min(3).max(253),
    verificationToken: z.string().min(1).max(256).optional(),
    isVerified: z.boolean().default(false),
  }),
);

const authSchema = z.object({
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

// ---------------------------------------------------------------- handlers

/**
 * Upper bound on one import archive. A full export of a project can never exceed
 * the owner's storage cap, so the cap is the natural limit; the extra headroom
 * covers the ZIP framing and the clear-text config/secrets sections.
 */
const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

async function maxImportBytes(userId: number): Promise<number> {
  const user = await getUserById(userId);
  const cap = Number(user?.storageCapBytes ?? 0);
  return cap > 0 ? Math.min(cap * 2, MAX_IMPORT_BYTES) : MAX_IMPORT_BYTES;
}

/** Parse a JSON section of an archive, reporting a 400 instead of a 500. */
function parseJsonSection<T>(entry: { path: string; content: Buffer }, label: string): T {
  try {
    return JSON.parse(entry.content.toString("utf8")) as T;
  } catch {
    throw new ApiError("bad_request", `${label} is not valid JSON.`);
  }
}

/** GET /api/export/{feature}?projectId=N */
export const exportFeatureHandler = handler(async (request, context) => {
  const { feature } = await context.params;
  const url = new URL(request.url);
  const project = await ownerProject(request, Number(url.searchParams.get("projectId")));
  const data = await exportFeature(project.id, featureFromParam(feature ?? ""));
  return apiOk({ feature, projectId: project.id, data });
});

/** GET /api/export/all?projectId=N — ZIP archive. */
export const exportAllHandler = handler(async (request) => {
  const url = new URL(request.url);
  const project = await ownerProject(request, Number(url.searchParams.get("projectId")));
  const zip = await buildProjectExport(project.id, project.name);
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project.name}-export.zip"`,
    },
  }) as unknown as import("next/server").NextResponse;
});

/** POST /api/import/{feature}?projectId=N — JSON body, overwrites the feature. */
export const importFeatureHandler = handler(async (request, context) => {
  const { feature } = await context.params;
  const url = new URL(request.url);
  const project = await ownerProject(request, Number(url.searchParams.get("projectId")));
  const resolved = featureFromParam(feature ?? "");
  const raw = (await request.json().catch(() => {
    throw new ApiError("bad_request", "Body must be valid JSON.");
  })) as unknown;
  // Accept either the raw feature payload or `{ data: ... }` (export round-trip).
  const payload =
    raw && typeof raw === "object" && !Array.isArray(raw) && "data" in raw && resolved !== "auth"
      ? (raw as { data: unknown }).data
      : raw;
  const result = await importFeature(project.id, resolved, payload);
  return apiOk({ success: true, feature: resolved, ...result });
});

/** POST /api/import/all?projectId=N — ZIP body (multipart `file` or raw). */
export const importAllHandler = handler(async (request) => {
  const url = new URL(request.url);
  const project = await ownerProject(request, Number(url.searchParams.get("projectId")));
  const principal = await requireSessionUser(request);

  const maxBytes = await maxImportBytes(principal.userId!);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new ApiError("payment_required", `Archive is larger than your ${maxBytes} byte storage cap.`);
  }

  let archive: Buffer;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("bad_request", "Missing file field.");
    archive = Buffer.from(await file.arrayBuffer());
  } else {
    archive = Buffer.from(await request.arrayBuffer());
  }
  if (archive.byteLength > maxBytes) {
    throw new ApiError("payment_required", `Archive is larger than your ${maxBytes} byte storage cap.`);
  }

  let entries: Array<{ path: string; content: Buffer }>;
  try {
    entries = readZip(archive, { maxEntryBytes: MAX_IMPORT_BYTES });
  } catch {
    throw new ApiError("bad_request", "Body must be a ZIP archive produced by /api/export/all.");
  }

  let files = 0;
  let skipped = 0;
  for (const entry of entries) {
    const target = entry.path.startsWith("lib/")
      ? { path: entry.path.slice("lib/".length), library: true }
      : entry.path.startsWith("storage/")
        ? { path: entry.path.slice("storage/".length), library: false }
        : null;
    if (!target) continue;
    // A hostile archive must not abort the whole restore, and putFile refuses
    // traversal paths anyway — count them so the caller can see what happened.
    if (!target.path || target.path.length > 512 || target.path.includes("..") || target.path.startsWith("/")) {
      skipped += 1;
      continue;
    }
    await putFile(principal.userId!, project.id, target.path, entry.content, target.library);
    files += 1;
  }

  let features = 0;
  const configEntry = entries.find((entry) => entry.path === "config/config.json");
  if (configEntry) {
    const bundle = parseJsonSection<Record<string, unknown>>(configEntry, "config/config.json");
    for (const feature of EXPORT_FEATURES) {
      if (bundle[feature] === undefined) continue;
      try {
        await importFeature(project.id, feature, bundle[feature]);
        features += 1;
      } catch {
        // A single malformed section must not abort the whole restore.
      }
    }
  }

  const secretsEntry = entries.find((entry) => entry.path === "config/secrets.json");
  if (secretsEntry) {
    await importFeature(project.id, "secrets", parseJsonSection(secretsEntry, "config/secrets.json"));
  }

  return apiOk({ success: true, files, features, skipped });
});

/**
 * Selective configuration transfer (Blueprint §5.10, extended).
 *
 * The per-feature export/import in ./export-routes is *destructive*: importing
 * a feature deletes every existing row for that feature first. That is the right
 * behaviour for a restore and the wrong one for the console, where an owner
 * wants to copy two roles, three routes or a handful of secrets between their
 * own projects without losing anything else.
 *
 * This module adds the additive half of that story:
 *
 *   GET  /api/transfer?projectId=N&feature=routes[&ids=a,b]
 *          → JSON for exactly the selected items (no `ids` = everything).
 *          Secrets are names only, as everywhere else (§5.10).
 *   POST /api/transfer?projectId=N
 *          { feature, mode: "merge" | "replace", items[], ids[] }
 *          → merge (default) upserts by natural key and never deletes;
 *            replace only deletes when `ids` is omitted.
 *   POST /api/transfer?projectId=N
 *          { feature: "auth", mode: "copy-from", sourceProjectId: M, ids[] }
 *          → copies visitors from another project of the same owner, creating
 *            any role the destination does not have yet.
 *
 * Every read and write stays inside projects owned by the caller.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { encryptSecret } from "@/lib/server/secrets-crypto";
import { createLogger } from "@/lib/server/logger";
import { requireOwnedProject, type ProjectRecord } from "@/lib/server/repos";

const log = createLogger("transfer");

/** Features this endpoint can move between projects. */
export const TRANSFER_FEATURES = ["routes", "secrets", "auth", "roles"] as const;
export type TransferFeature = (typeof TRANSFER_FEATURES)[number];

function bind(value: boolean): number | boolean {
  return getDb().driver === "sqlite" ? (value ? 1 : 0) : value;
}

function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

function parseArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Owner-only resolution, with an optional explicit project id. */
async function ownedProject(request: Request, explicit: string | null): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  const raw = explicit ?? request.headers.get("x-project-id");
  const projectId = Number(raw);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  return requireOwnedProject(principal.userId!, projectId);
}

/** Normalise a path pattern so "/" and "/reports" compare predictably. */
function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

// ------------------------------------------------------------------ read

interface TransferItem {
  id: string;
  data: Record<string, unknown>;
}

async function readAll(projectId: number, feature: TransferFeature): Promise<TransferItem[]> {
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

// ----------------------------------------------------------------- write

const routeItem = z.object({
  pathPattern: z.string().min(1).max(256),
  targetFile: z.string().max(512).nullable().optional(),
  isProxy: z.boolean().default(false),
  proxyConfig: z.unknown().optional(),
  requiresAuth: z.boolean().default(false),
  requiredRole: z.string().max(64).nullable().optional(),
  requiredPermission: z.string().max(64).nullable().optional(),
  isActive: z.boolean().default(true),
});

const secretItem = z.object({
  key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
  value: z.string().max(64_000).optional(),
});

const visitorItem = z.object({
  username: z.string().min(1).max(64),
  role: z.string().max(64).default("Member"),
  isActive: z.boolean().default(true),
});

const roleItem = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string().max(64)).default([]),
});

const transferSchema = z.object({
  feature: z.enum(TRANSFER_FEATURES),
  mode: z.enum(["merge", "replace", "copy-from"]).default("merge"),
  items: z.array(z.unknown()).optional(),
  ids: z.array(z.string()).optional(),
  sourceProjectId: z.number().int().positive().optional(),
});

/** Roles every project is seeded with; never treated as "missing". */
const BASE_ROLES = new Set(["Owner", "Admin", "Member", "Guest"]);

async function upsertRoles(projectId: number, roles: { name: string; permissions: string[] }[]): Promise<number> {
  const db = getDb();
  const p = db.driver;
  let written = 0;
  for (const role of roles) {
    const existing = await db.raw<{ id: number }>(
      `SELECT id FROM roles WHERE project_id = ${placeholder(p, 0)} AND name = ${placeholder(p, 1)}`,
      [projectId, role.name],
    );
    if (existing[0]) {
      await db.run(
        `UPDATE roles SET permissions = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)}
         WHERE id = ${placeholder(p, 2)}`,
        [JSON.stringify(role.permissions), new Date().toISOString(), existing[0].id],
      );
    } else {
      await db.run(
        `INSERT INTO roles (project_id, name, permissions) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
        [projectId, role.name, JSON.stringify(role.permissions)],
      );
    }
    written += 1;
  }
  return written;
}

/**
 * Copy visitors from another project of the same owner, creating any role the
 * destination is missing (with the source project's permissions for it).
 */
async function copyVisitors(
  target: ProjectRecord,
  sourceProjectId: number,
  ids: string[],
): Promise<{ visitors: number; rolesCreated: string[] }> {
  const db = getDb();
  const p = db.driver;
  const sourceRows = await db.raw<Record<string, unknown>>(
    `SELECT v.username, v.is_active, COALESCE(r.name, 'Member') AS role
     FROM visitors v LEFT JOIN roles r ON r.id = v.role_id
     WHERE v.project_id = ${placeholder(p, 0)} ORDER BY v.username`,
    [sourceProjectId],
  );
  let rows = sourceRows;
  if (ids.length > 0) {
    const wanted = new Set(ids);
    rows = rows.filter((row) => wanted.has(String(row.username)));
  }
  if (rows.length === 0) throw new ApiError("bad_request", "No visitors selected in the source project.");

  // Bring across the roles this batch needs, creating any that are missing.
  const needed = [...new Set(rows.map((row) => String(row.role)))].filter((name) => !BASE_ROLES.has(name));
  const rolesCreated: string[] = [];
  if (needed.length > 0) {
    const sourceRoles = await db.raw<Record<string, unknown>>(
      `SELECT name, permissions FROM roles WHERE project_id = ${placeholder(p, 0)}`,
      [sourceProjectId],
    );
    const byName = new Map(sourceRoles.map((row) => [String(row.name), parseArray(row.permissions)]));
    const present = await db.raw<{ name: string }>(
      `SELECT name FROM roles WHERE project_id = ${placeholder(p, 0)}`,
      [target.id],
    );
    const have = new Set(present.map((row) => String(row.name)));
    const toCreate = needed
      .filter((name) => !have.has(name))
      .map((name) => ({ name, permissions: byName.get(name) ?? [] }));
    if (toCreate.length > 0) {
      await upsertRoles(target.id, toCreate);
      rolesCreated.push(...toCreate.map((role) => role.name));
    }
  }

  let visitors = 0;
  for (const row of rows) {
    const role = await db.raw<{ id: number }>(
      `SELECT id FROM roles WHERE project_id = ${placeholder(p, 0)} AND name = ${placeholder(p, 1)}`,
      [target.id, String(row.role)],
    );
    if (!role[0]) throw new ApiError("bad_request", `Role "${String(row.role)}" does not exist.`);
    // Password hashes are deliberately never copied (§5.10), so an imported
    // visitor is created disabled and has to be re-invited.
    const existing = await db.raw<{ id: number }>(
      `SELECT id FROM visitors WHERE project_id = ${placeholder(p, 0)} AND username = ${placeholder(p, 1)}`,
      [target.id, String(row.username)],
    );
    const unmatchedHash = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;
    if (existing[0]) {
      await db.run(
        `UPDATE visitors SET role_id = ${placeholder(p, 0)}, is_active = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
        [role[0].id, bind(false), existing[0].id],
      );
    } else {
      // Copied visitors land disabled whatever the source said: the password
      // hash never left the source project, so they have to be re-invited.
      await db.run(
        `INSERT INTO visitors (project_id, username, password_hash, role_id, is_active)
         VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})`,
        [target.id, String(row.username), unmatchedHash, role[0].id, bind(false)],
      );
    }
    visitors += 1;
  }
  return { visitors, rolesCreated };
}

async function writeItems(
  projectId: number,
  feature: TransferFeature,
  mode: "merge" | "replace",
  ids: string[],
  rawItems: unknown[],
): Promise<number> {
  const db = getDb();
  const p = db.driver;
  const now = new Date().toISOString();

  switch (feature) {
    case "routes": {
      const items = z.array(routeItem).parse(rawItems).map((item) => ({
        ...item,
        pathPattern: normalizePath(item.pathPattern),
      }));
      if (mode === "replace" && ids.length === 0) {
        await db.run(`DELETE FROM routes WHERE project_id = ${placeholder(p, 0)}`, [projectId]);
      }
      let written = 0;
      for (const item of items) {
        const existing = await db.raw<{ id: number }>(
          `SELECT id FROM routes WHERE project_id = ${placeholder(p, 0)} AND path_pattern = ${placeholder(p, 1)}`,
          [projectId, item.pathPattern],
        );
        const values = [
          item.targetFile ?? null,
          bind(item.isProxy),
          item.proxyConfig ? JSON.stringify(item.proxyConfig) : null,
          bind(item.requiresAuth),
          item.requiredRole ?? null,
          item.requiredPermission ?? null,
          bind(item.isActive),
          now,
        ];
        if (existing[0]) {
          await db.run(
            `UPDATE routes SET target_file = ${placeholder(p, 0)}, is_proxy = ${placeholder(p, 1)},
               proxy_config = ${placeholder(p, 2)}, requires_auth = ${placeholder(p, 3)},
               required_role = ${placeholder(p, 4)}, required_permission = ${placeholder(p, 5)},
               is_active = ${placeholder(p, 6)}, updated_at = ${placeholder(p, 7)}
             WHERE id = ${placeholder(p, 8)}`,
            [...values, existing[0].id],
          );
        } else {
          await db.run(
            `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, required_permission, is_active, updated_at)
             VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)}, ${placeholder(p, 6)}, ${placeholder(p, 7)}, ${placeholder(p, 8)}, ${placeholder(p, 9)})`,
            [projectId, item.pathPattern, ...values],
          );
        }
        written += 1;
      }
      return written;
    }
    case "secrets": {
      const items = z.array(secretItem).parse(rawItems);
      if (mode === "replace" && ids.length === 0) {
        await db.run(`DELETE FROM secrets WHERE project_id = ${placeholder(p, 0)}`, [projectId]);
      }
      let written = 0;
      for (const item of items) {
        if (item.value === undefined) continue; // names-only export: keep what we have
        const existing = await db.raw<{ id: number }>(
          `SELECT id FROM secrets WHERE project_id = ${placeholder(p, 0)} AND key_name = ${placeholder(p, 1)}`,
          [projectId, item.key],
        );
        // Without SESSION_SECRET nothing can be sealed. That is a configuration
        // problem the operator can fix, not a server fault, so say so plainly
        // instead of answering 500.
        let sealed: string;
        try {
          sealed = await encryptSecret(item.value);
        } catch {
          throw new ApiError(
            "bad_request",
            "Secrets cannot be stored: SESSION_SECRET is not set on this deployment.",
          );
        }
        if (existing[0]) {
          await db.run(
            `UPDATE secrets SET encrypted_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
            [sealed, now, existing[0].id],
          );
        } else {
          await db.run(
            `INSERT INTO secrets (project_id, key_name, encrypted_value, created_at, updated_at)
             VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})`,
            [projectId, item.key, sealed, now, now],
          );
        }
        written += 1;
      }
      return written;
    }
    case "roles": {
      const items = z.array(roleItem).parse(rawItems);
      if (mode === "replace" && ids.length === 0) {
        await db.run(`DELETE FROM roles WHERE project_id = ${placeholder(p, 0)}`, [projectId]);
      }
      return upsertRoles(projectId, items);
    }
    case "auth": {
      const items = z.array(visitorItem).parse(rawItems);
      if (mode === "replace" && ids.length === 0) {
        await db.run(`DELETE FROM visitors WHERE project_id = ${placeholder(p, 0)}`, [projectId]);
      }
      const unmatchedHash = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;
      let written = 0;
      for (const item of items) {
        const role = await db.raw<{ id: number }>(
          `SELECT id FROM roles WHERE project_id = ${placeholder(p, 0)} AND name = ${placeholder(p, 1)}`,
          [projectId, item.role],
        );
        if (!role[0]) {
          throw new ApiError(
            "bad_request",
            `Role "${item.role}" does not exist in this project. Create it first, or use "Add from project…".`,
          );
        }
        const existing = await db.raw<{ id: number }>(
          `SELECT id FROM visitors WHERE project_id = ${placeholder(p, 0)} AND username = ${placeholder(p, 1)}`,
          [projectId, item.username],
        );
        if (existing[0]) {
          await db.run(
            `UPDATE visitors SET role_id = ${placeholder(p, 0)}, is_active = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
            [role[0].id, bind(item.isActive), existing[0].id],
          );
        } else {
          await db.run(
            `INSERT INTO visitors (project_id, username, password_hash, role_id, is_active, created_at)
             VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)})`,
            [projectId, item.username, unmatchedHash, role[0].id, bind(false), now],
          );
        }
        written += 1;
      }
      return written;
    }
    default: {
      // Exhaustiveness guard: a new feature must pick a write strategy.
      const unreachable: never = feature;
      throw new ApiError("bad_request", `Unsupported feature ${String(unreachable)}`);
    }
  }
}

/** POST /api/transfer?projectId=N — merge, replace or copy from another project. */
export const transferImport = handler(async (request) => {
  const url = new URL(request.url);
  const project = await ownedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, transferSchema);
  const ids = (body.ids ?? []).map((value) => value.trim()).filter(Boolean);

  if (body.mode === "copy-from") {
    if (body.feature !== "auth" && body.feature !== "roles") {
      throw new ApiError("bad_request", "copy-from supports the auth and roles features.");
    }
    if (!body.sourceProjectId) {
      throw new ApiError("bad_request", "sourceProjectId is required for copy-from.");
    }
    // Same owner on both sides: requireOwnedProject is an ownership check, so a
    // project belonging to somebody else is refused here.
    const owner = await requireSessionUser(request);
    const source = await requireOwnedProject(owner.userId!, body.sourceProjectId);
    if (body.feature === "roles") {
      const copied = await writeItems(project.id, "roles", "merge", ids, (await readAll(source.id, "roles")).map((item) => item.data));
      log.info("transfer.copy_from", { projectId: project.id, sourceId: source.id, feature: "roles", count: copied });
      return apiOk({ feature: "roles", written: copied, visitors: 0, rolesCreated: [] });
    }
    const result = await copyVisitors(project, source.id, ids);
    log.info("transfer.copy_from", {
      projectId: project.id,
      sourceId: source.id,
      feature: "auth",
      count: result.visitors,
      rolesCreated: result.rolesCreated,
    });
    return apiOk({
      feature: "auth",
      written: result.visitors,
      visitors: result.visitors,
      rolesCreated: result.rolesCreated,
    });
  }

  const items = body.items ?? [];
  if (items.length === 0 && !(body.mode === "replace" && ids.length === 0)) {
    throw new ApiError("bad_request", "Nothing to import: send `items`, or use mode=replace with no ids.");
  }
  const written = await writeItems(project.id, body.feature, body.mode, ids, items);
  log.info("transfer.import", { projectId: project.id, feature: body.feature, mode: body.mode, written });
  return apiOk({ feature: body.feature, mode: body.mode, written });
});

/** Column names a transfer payload uses, so the console can render a diff. */
export const TRANSFER_FIELDS: Record<TransferFeature, readonly string[]> = {
  routes: ["pathPattern", "targetFile", "isProxy", "requiresAuth", "requiredRole", "requiredPermission", "isActive"],
  secrets: ["key", "value"],
  auth: ["username", "role", "isActive"],
  roles: ["name", "permissions"],
};
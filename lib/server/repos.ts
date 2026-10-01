/**
 * Typed repositories for platform tables, on the dialect-agnostic facade.
 *
 * Each function validates identifiers, parameterizes every value, and maps
 * dialect booleans/timestamps to TS types. Keep business rules (caps, quotas,
 * cascade deletes) here so route handlers stay thin.
 */
import { generateToken, hashPassword, hashToken, verifyPassword } from "./crypto";
import { getDb } from "./db/index";
import { quote, placeholder } from "./db/sql";
import { ApiError } from "./http";
import { configNumber, setting } from "./system-config";
import { createLogger } from "./logger";
import { invalidateAsset } from "./asset-cache";
import { withProjectWriteLock } from "./write-lock";
import { CRON_TASKS, DEFAULT_TASK_PARAMETERS, nextRunAtFor } from "./cron-tasks";

const DEFAULT_STORAGE_CAP = 2_097_152; // 2 MB free tier (spec §10 storage.default_user_cap_bytes)
const log = createLogger("repos");

/**
 * The 15 granular permissions of Blueprint §5.5, in documented order.
 * Route-scoped grants (`route_access_{routeId}`) are added per route.
 */
export const PERMISSIONS = [
  "db_read",
  "db_write",
  "db_admin",
  "storage_read",
  "storage_write",
  "storage_admin",
  "lib_read",
  "lib_write",
  "domains_manage",
  "secrets_admin",
  "webhooks_manage",
  "cron_manage",
  "visitors_manage",
  "project_manage",
  "analytics_read",
] as const;

/** Pre-defined project roles (§5.5) seeded on project creation. */
export const DEFAULT_ROLES: Array<{ name: string; permissions: string[] }> = [
  { name: "Owner", permissions: [...PERMISSIONS] },
  { name: "Admin", permissions: PERMISSIONS.filter((p) => p !== "project_manage") },
  { name: "Member", permissions: ["db_read", "storage_read", "lib_read", "analytics_read"] },
  { name: "Guest", permissions: ["db_read", "lib_read"] },
];

// ---------------------------------------------------------------- users

export interface UserRecord {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isOperator: boolean;
  isSuspended: boolean;
  storageCapBytes: number;
  createdAt: string;
  /** Last successful console login, or null if the account has never signed in. */
  lastLogin: string | null;
  /** Set while repeated failures have locked the account out (§7.2). */
  lockedUntil: string | null;
}

function mapUser(row: Record<string, unknown>): UserRecord {
  const bool = (v: unknown) => v === 1 || v === true;
  return {
    id: Number(row.id),
    username: String(row.username),
    email: (row.email as string | null) ?? null,
    isAdmin: bool(row.is_admin),
    isOperator: bool(row.is_operator),
    isSuspended: bool(row.is_suspended),
    storageCapBytes: Number(row.storage_cap_bytes ?? DEFAULT_STORAGE_CAP),
    createdAt: String(row.created_at ?? ""),
    lastLogin: (row.last_login as string | null) ?? null,
    lockedUntil: (row.locked_until as string | null) ?? null,
  };
}

function insertReturningId(table: string, columns: string[], values: unknown[]): Promise<number> {
  const db = getDb();
  const p = db.driver;
  const placeholders = values.map((_, i) => placeholder(p, i)).join(", ");
  const cols = columns.map((c) => quote.ident(c)).join(", ");
  // RETURNING works on Postgres natively; SQLite 3.35+ also supports it.
  return db
    .raw<{ id: number }>(
      `INSERT INTO ${quote.ident(table)} (${cols}) VALUES (${placeholders}) RETURNING id`,
      values,
    )
    .then((rows) => Number(rows[0]!.id));
}

export async function createUser(username: string, password: string, email?: string): Promise<UserRecord> {
  const usernameNorm = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(usernameNorm)) {
    throw new ApiError("bad_request", "Username must be 3-32 chars: a-z, 0-9, _ or -.");
  }
  if (password.length < 8) {
    throw new ApiError("bad_request", "Password must be at least 8 characters.");
  }
  const passwordHash = await hashPassword(password);
  const cap = await setting("storage.default_user_cap_bytes");
  try {
    const id = await insertReturningId(
      "users",
      ["username", "password_hash", "email", "storage_cap_bytes"],
      [usernameNorm, passwordHash, email ?? null, cap > 0 ? cap : DEFAULT_STORAGE_CAP],
    );
    return (await getUserById(id))!;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("conflict", "That username is taken.");
    }
    throw error;
  }
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM users WHERE id = ${placeholder(db.driver, 0)}`,
    [id],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<(UserRecord & { passwordHash: string; lockedUntil: string | null }) | null> {
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM users WHERE username = ${placeholder(db.driver, 0)}`,
    [username.trim().toLowerCase()],
  );
  if (!rows[0]) return null;
  const mapped = mapUser(rows[0]);
  return { ...mapped, passwordHash: String(rows[0].password_hash), lockedUntil: (rows[0].locked_until as string | null) ?? null };
}

/** Verify credentials; updates last_login and rejects suspended accounts. */
export async function authenticateUser(username: string, password: string): Promise<UserRecord> {
  const record = await getUserByUsername(username);
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    if (record) await recordFailedLogin(record.id);
    log.warn("login_failed", { username: username.trim().toLowerCase(), known_user: Boolean(record) });
    throw new ApiError("unauthorized", "Invalid username or password.");
  }
  if (record.isSuspended) {
    throw new ApiError("forbidden", "This account is suspended.");
  }
  const db = getDb();
  const p = db.driver;
  // A good password clears the failure streak and any expired lockout.
  await db.run(
    `UPDATE users SET last_login = ${placeholder(p, 0)}, failed_login_count = 0, locked_until = NULL
     WHERE id = ${placeholder(p, 1)}`,
    [new Date().toISOString(), record.id],
  );
  return record;
}

/**
 * Count failed logins and lock the account after `auth.max_failed_logins`
 * (default 5) for `auth.lockout_minutes` (default 15). Reset on success.
 */
async function recordFailedLogin(userId: number): Promise<void> {
  const db = getDb();
  const p = db.driver;
  const [maxFailed, lockoutMinutes] = await Promise.all([
    configNumber("auth.max_login_attempts", 5),
    configNumber("auth.lockout_minutes", 5),
  ]);
  await db.run(
    `UPDATE users SET failed_login_count = failed_login_count + 1
     WHERE id = ${placeholder(p, 0)}`,
    [userId],
  );
  const rows = await db.raw<{ count: number }>(
    `SELECT failed_login_count AS count FROM users WHERE id = ${placeholder(p, 0)}`,
    [userId],
  );
  if (Number(rows[0]?.count ?? 0) >= maxFailed) {
    log.warn("account_locked", { userId, lockout_minutes: lockoutMinutes });
    await db.run(
      `UPDATE users SET locked_until = ${placeholder(p, 0)}, failed_login_count = 0
       WHERE id = ${placeholder(p, 1)}`,
      [new Date(Date.now() + lockoutMinutes * 60_000).toISOString(), userId],
    );
  }
}

/** Throw 423 when the account is inside its lockout window (Blueprint §7.2). */
export async function assertNotLocked(username: string): Promise<void> {
  const db = getDb();
  const rows = await db.raw<{ locked_until: string | null }>(
    `SELECT locked_until FROM users WHERE username = ${placeholder(db.driver, 0)}`,
    [username.trim().toLowerCase()],
  );
  const lockedUntil = rows[0]?.locked_until;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    throw new ApiError("unauthorized", "Account temporarily locked. Try again later.");
  }
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new ApiError("bad_request", "Password must be at least 8 characters.");
  }
  const record = await getUserByUsername(
    (await getUserById(userId))?.username ?? "",
  );
  if (!record || !(await verifyPassword(currentPassword, record.passwordHash))) {
    throw new ApiError("unauthorized", "Current password is incorrect.");
  }
  const hash = await hashPassword(newPassword);
  const db = getDb();
  await db.run(
    `UPDATE users SET password_hash = ${placeholder(db.driver, 0)}, updated_at = ${placeholder(db.driver, 1)} WHERE id = ${placeholder(db.driver, 2)}`,
    [hash, new Date().toISOString(), userId],
  );
}

export async function updateEmail(userId: number, email: string | null): Promise<void> {
  const db = getDb();
  try {
    await db.run(
      `UPDATE users SET email = ${placeholder(db.driver, 0)}, updated_at = ${placeholder(db.driver, 1)} WHERE id = ${placeholder(db.driver, 2)}`,
      [email, new Date().toISOString(), userId],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("conflict", "That email is already in use.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------- projects

export interface ProjectRecord {
  id: number;
  userId: number;
  name: string;
  storageAllocatedBytes: number;
  freeVisitsPerMonth: number;
  isActive: boolean;
  watermarkEnabled: boolean;
  createdAt: string;
}

function mapProject(row: Record<string, unknown>): ProjectRecord {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    name: String(row.name),
    storageAllocatedBytes: Number(row.storage_allocated_bytes ?? 0),
    freeVisitsPerMonth: Number(row.free_visits_per_month ?? 100),
    isActive: row.is_active === 1 || row.is_active === true,
    watermarkEnabled: row.watermark_enabled == null || row.watermark_enabled === 1 || row.watermark_enabled === true,
    createdAt: String(row.created_at ?? ""),
  };
}

/**
 * The reserved project name that holds a user's shared asset library.
 *
 * `library` is a keyword, not a project: `/{user}/library/theme.css` is a
 * stable public URL for an asset the account uploaded once and every one of
 * its projects references. Reserving the name is what makes that URL mean one
 * thing — otherwise a project called `library` would shadow the namespace, and
 * the CDN path would belong to whoever created it first.
 */
export const LIBRARY_PROJECT_NAME = "library";

/** Whether a project name is reserved by the platform. */
export function isReservedProjectName(name: string): boolean {
  return name.trim().toLowerCase() === LIBRARY_PROJECT_NAME;
}

/**
 * The user's library project, created on first use.
 *
 * The library is a real project row rather than a parallel storage table so it
 * reuses everything a project already gets for free: ownership checks, the
 * per-user storage cap, ETags, the asset cache, compression and minification.
 * It is seeded bare — no welcome page, no routes, no cron — because it is
 * never browsed as a site.
 */
export async function ensureLibraryProject(userId: number): Promise<ProjectRecord> {
  const db = getDb();
  const existing = await db.raw<Record<string, unknown>>(
    `SELECT * FROM projects WHERE user_id = ${placeholder(db.driver, 0)} AND name = ${placeholder(db.driver, 1)}`,
    [userId, LIBRARY_PROJECT_NAME],
  );
  if (existing[0]) return mapProject(existing[0]);
  try {
    const id = await insertReturningId(
      "projects",
      ["user_id", "name", "free_visits_per_month"],
      [userId, LIBRARY_PROJECT_NAME, 0],
    );
    return (await getProjectById(id))!;
  } catch (error) {
    // Two concurrent first calls (the library page loads its list and its usage
    // together) both see "no library project" and both insert. The unique
    // (user_id, name) constraint rejects the loser, which is not a failure —
    // re-read and use the row the winner created.
    if (!isUniqueViolation(error)) throw error;
    const raced = await db.raw<Record<string, unknown>>(
      `SELECT * FROM projects WHERE user_id = ${placeholder(db.driver, 0)} AND name = ${placeholder(db.driver, 1)}`,
      [userId, LIBRARY_PROJECT_NAME],
    );
    if (!raced[0]) throw error;
    return mapProject(raced[0]);
  }
}

export async function createProject(userId: number, name: string): Promise<ProjectRecord> {
  const nameNorm = name.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(nameNorm)) {
    throw new ApiError("bad_request", "Project name must be 1-63 chars: a-z, 0-9, _ or - (starting letter/digit).");
  }
  if (isReservedProjectName(nameNorm)) {
    throw new ApiError(
      "bad_request",
      "“library” is reserved — it is where your shared assets are served from.",
    );
  }
  try {
    const freeVisits = await setting("visits.free_visits_per_month");
    const id = await insertReturningId(
      "projects",
      ["user_id", "name", "free_visits_per_month"],
      [userId, nameNorm, freeVisits > 0 ? freeVisits : 100],
    );
    await seedProject(userId, id, nameNorm);
    return (await getProjectById(id))!;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("conflict", "You already have a project with that name.");
    }
    throw error;
  }
}

/**
 * Seed a new project with the documented scaffold: welcome page, PWA manifest +
 * service worker + placeholder icon (Blueprint §12), the four pre-defined roles
 * (§5.5), the `/` → index.html route (§5.4), and the built-in cron tasks (§5.8).
 */
async function seedProject(userId: number, projectId: number, name: string): Promise<void> {
  const db = getDb();
  const p = db.driver;

  const welcome = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
    <!-- Relative, not absolute: a shared-path project is served from
         /{username}/{project}/, so "/manifest.json" would resolve against the
         platform root and 404. Relative URLs travel with the project and work
         unchanged on a verified custom domain. -->
    <link rel="manifest" href="manifest.json" />
    <link rel="icon" href="icons/icon.svg" type="image/svg+xml" />
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; }
      code { background: rgba(127,127,127,.15); padding: .15em .35em; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>${name} is live</h1>
    <p>This is the seeded welcome page. Replace <code>index.html</code> with your own HTML.</p>
    <ul>
      <li><code>manifest.json</code> — PWA manifest</li>
      <li><code>sw.js</code> — service worker (delete it to disable PWA support)</li>
      <li><code>icons/icon.svg</code> — placeholder icon</li>
    </ul>
  </body>
</html>
`;

  const manifest = JSON.stringify(
    {
      name,
      short_name: name,
      // Relative to the manifest itself, so the PWA installs from whichever host
      // serves the project (a /{username}/{project}/ path or a custom domain).
      start_url: ".",
      scope: ".",
      display: "standalone",
      background_color: "#0b1020",
      theme_color: "#0b1020",
      icons: [{ src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
    },
    null,
    2,
  );

  const serviceWorker = `// LocalMe default service worker (Blueprint §12).
// Caches the shell so the app opens offline; delete this file to disable PWA support.
// The scope is this script's directory, e.g. /ada/atlas-dashboard/. Caching
// absolute paths would cache the platform's own pages, not this project's.
const BASE = new URL(".", self.location.href).pathname.replace(/\/$/, "");
const CACHE = "localme-${name}-v1";
const SHELL = [BASE + "/", BASE + "/index.html", BASE + "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
`;

  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="#0b1020" />
  <text x="50%" y="57%" text-anchor="middle" font-family="monospace" font-size="26" fill="#7d9dff">${name.slice(0, 1).toUpperCase()}</text>
</svg>
`;

  const scaffold: Array<[string, string]> = [
    ["index.html", welcome],
    ["manifest.json", manifest],
    ["sw.js", serviceWorker],
    ["icons/icon.svg", icon],
  ];
  for (const [path, content] of scaffold) {
    await putFile(userId, projectId, path, Buffer.from(content, "utf8"));
  }

  for (const role of DEFAULT_ROLES) {
    await db.run(
      `INSERT INTO roles (project_id, name, permissions) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
      [projectId, role.name, JSON.stringify(role.permissions)],
    );
  }

  await db.run(
    `INSERT INTO routes (project_id, path_pattern, target_file, is_active)
     VALUES (${placeholder(p, 0)}, '/', 'index.html', ${p === "sqlite" ? 1 : "TRUE"})`,
    [projectId],
  );

  const now = new Date().toISOString();
  for (const task of CRON_TASKS) {
    await db.run(
      `INSERT INTO cron_configs (project_id, task_name, is_enabled, parameters, next_run_at)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${p === "sqlite" ? 1 : "TRUE"}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [projectId, task, JSON.stringify(DEFAULT_TASK_PARAMETERS[task] ?? {}), nextRunAtFor(task, now)],
    );
  }
}

export async function getProjectById(id: number): Promise<ProjectRecord | null> {
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM projects WHERE id = ${placeholder(db.driver, 0)}`,
    [id],
  );
  return rows[0] ? mapProject(rows[0]) : null;
}

/** Owner username for a project (visitor cookie path scoping, docs §6.2). */
export async function getProjectOwnerUsername(projectId: number): Promise<string | null> {
  const db = getDb();
  const rows = await db.raw<{ username: string }>(
    `SELECT u.username FROM projects pr JOIN users u ON u.id = pr.user_id
     WHERE pr.id = ${placeholder(db.driver, 0)} LIMIT 1`,
    [projectId],
  );
  return rows[0]?.username ?? null;
}

export async function listProjectsByUser(userId: number): Promise<ProjectRecord[]> {
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM projects WHERE user_id = ${placeholder(db.driver, 0)} ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapProject);
}

/** Ownership check used by every project-scoped endpoint. */
export async function requireOwnedProject(userId: number, projectId: number): Promise<ProjectRecord> {
  const project = await getProjectById(projectId);
  if (!project) throw new ApiError("not_found", "Project not found.");
  if (project.userId !== userId) throw new ApiError("forbidden", "Not your project.");
  return project;
}

/**
 * Rename, suspend/resume, or toggle the watermark. Nulls are left unchanged.
 * Renames keep the (user_id, name) uniqueness contract.
 */
export async function updateProject(
  userId: number,
  projectId: number,
  patch: { name?: string; isActive?: boolean; watermarkEnabled?: boolean },
): Promise<ProjectRecord> {
  await requireOwnedProject(userId, projectId);
  const db = getDb();
  const p = db.driver;
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ${placeholder(p, values.length)}`);
    values.push(value);
  };

  if (patch.name !== undefined) {
    const nameNorm = patch.name.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(nameNorm)) {
      throw new ApiError("bad_request", "Project name must be 1-63 chars: a-z, 0-9, _ or - (starting letter/digit).");
    }
    add("name", nameNorm);
  }
  if (patch.isActive !== undefined) {
    add("is_active", p === "sqlite" ? (patch.isActive ? 1 : 0) : patch.isActive);
  }
  if (patch.watermarkEnabled !== undefined) {
    add("watermark_enabled", p === "sqlite" ? (patch.watermarkEnabled ? 1 : 0) : patch.watermarkEnabled);
  }
  if (sets.length === 0) {
    return (await getProjectById(projectId))!;
  }
  sets.push(`updated_at = ${placeholder(p, values.length)}`);
  values.push(new Date().toISOString());
  values.push(projectId);
  try {
    await db.run(
      `UPDATE projects SET ${sets.join(", ")} WHERE id = ${placeholder(p, values.length - 1)}`,
      values,
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("conflict", "You already have a project with that name.");
    }
    throw error;
  }
  return (await getProjectById(projectId))!;
}

// ---------------------------------------------------------------- api keys

export interface ApiKeyRecord {
  id: number;
  projectId: number;
  name: string;
  prefix: string;
  /** Granular permissions (§5.5); empty means "full project access". */
  permissions: string[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const KEY_PREFIX_LEN = 12;

function parsePermissions(raw: unknown): string[] {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Malformed map reads as empty (full access for keys).
  }
  return [];
}

function mapApiKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
    prefix: String(row.prefix),
    permissions: parsePermissions(row.permissions),
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

/** Generate `sk_<43 chars>`; only the SHA-256 hash is stored. */
export async function createApiKey(
  userId: number,
  projectId: number,
  name: string,
  permissions: string[] = [],
): Promise<{ record: ApiKeyRecord; key: string }> {
  await requireOwnedProject(userId, projectId);
  const key = `sk_${generateToken(32)}`;
  const db = getDb();
  const p = db.driver;
  const id = await insertReturningId(
    "api_keys",
    ["project_id", "name", "key_hash", "prefix", "permissions"],
    [
      projectId,
      name.trim() || "default",
      hashToken(key),
      key.slice(0, KEY_PREFIX_LEN),
      JSON.stringify(permissions.filter((perm) => (PERMISSIONS as readonly string[]).includes(perm))),
    ],
  );
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_keys WHERE id = ${placeholder(p, 0)}`,
    [id],
  );
  return { key, record: mapApiKey(rows[0]!) };
}

/**
 * Resolve an API key to its project, or null. Keys auto-expire after
 * `auth.api_key_expiry_days` (default 90) of inactivity (§5.5); an expired key
 * is revoked on the spot so the next lookup is cheap.
 */
export async function resolveApiKey(key: string): Promise<ApiKeyRecord | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_keys WHERE key_hash = ${placeholder(p, 0)} AND revoked_at IS NULL`,
    [hashToken(key)],
  );
  const row = rows[0];
  if (!row) return null;

  const expiryDays = await setting("auth.api_key_expiry_days");
  const lastActivity = Date.parse(String(row.last_used_at ?? row.created_at ?? ""));
  if (expiryDays > 0 && Number.isFinite(lastActivity) && Date.now() - lastActivity > expiryDays * 86_400_000) {
    await db.run(
      `UPDATE api_keys SET revoked_at = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`,
      [new Date().toISOString(), Number(row.id)],
    );
    return null;
  }

  await db.run(`UPDATE api_keys SET last_used_at = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`, [
    new Date().toISOString(),
    Number(row.id),
  ]);
  return mapApiKey(row);
}

/** Rotate/limit a key's permission set (console only). */
export async function updateApiKeyPermissions(
  userId: number,
  projectId: number,
  keyId: number,
  permissions: string[],
): Promise<boolean> {
  await requireOwnedProject(userId, projectId);
  const db = getDb();
  const result = await db.run(
    `UPDATE api_keys SET permissions = ${placeholder(db.driver, 0)} WHERE id = ${placeholder(db.driver, 1)} AND project_id = ${placeholder(db.driver, 2)}`,
    [JSON.stringify(permissions), keyId, projectId],
  );
  return result.changes > 0;
}

// ---------------------------------------------------------------- files + quota

export interface FileRecord {
  id: number;
  projectId: number;
  path: string;
  isText: boolean;
  contentText: string | null;
  sizeBytes: number;
  updatedAt: string;
}

const TEXT_EXTENSIONS = /\.(html?|css|js|mjs|json|txt|md|svg|xml|csv|webmanifest)$/i;

/** Sum of every stored byte owned by a user (projects + library). */
export async function storageUsedBytes(userId: number): Promise<number> {
  const db = getDb();
  const rows = await db.raw<{ total: number | string }>(
    `SELECT COALESCE(SUM(f.size_bytes), 0) AS total
     FROM files f JOIN projects p ON p.id = f.project_id
     WHERE p.user_id = ${placeholder(db.driver, 0)}`,
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Bytes owned by a user in *project* files, excluding the shared library.
 *
 * The library lives in its own reserved project, so the split is by project
 * name rather than by a `library/` path prefix. The cap check needs the split:
 * the advertised "N MB of project storage plus M MB of shared library" is only
 * true when the two are accounted separately.
 */
export async function projectStorageUsedBytes(userId: number): Promise<number> {
  const db = getDb();
  const rows = await db.raw<{ total: number | string }>(
    `SELECT COALESCE(SUM(f.size_bytes), 0) AS total
     FROM files f JOIN projects p ON p.id = f.project_id
     WHERE p.user_id = ${placeholder(db.driver, 0)} AND p.name <> ${placeholder(db.driver, 1)}`,
    [userId, LIBRARY_PROJECT_NAME],
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Enforce the account storage cap before any write. `incomingBytes` is added to
 * current usage and compared against the budget (402 when over, per the
 * documented payment-required semantics).
 *
 * Library writes draw on `storage.library_cap_bytes`, which is an absolute
 * ceiling of its own. It used to be "the project cap plus a bonus", which made
 * the advertised allowance impossible to state and impossible to tune without
 * also changing every project's budget.
 */
export async function assertStorageCap(
  userId: number,
  incomingBytes: number,
  options: { library?: boolean } = {},
): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new ApiError("unauthorized", "Sign in required.");
  if (options.library) {
    const cap = await setting("storage.library_cap_bytes");
    const library = await ensureLibraryProject(userId);
    const db = getDb();
    const rows = await db.raw<{ total: number | string }>(
      `SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files
       WHERE project_id = ${placeholder(db.driver, 0)}`,
      [library.id],
    );
    const used = Number(rows[0]?.total ?? 0);
    if (used + incomingBytes > cap) {
      throw new ApiError(
        "payment_required",
        `Library cap exceeded — this account has ${Math.round(cap / 1024 / 1024)} MB for shared assets.`,
      );
    }
    return;
  }
  const used = await projectStorageUsedBytes(userId);
  if (used + incomingBytes > user.storageCapBytes) {
    throw new ApiError(
      "payment_required",
      `Storage cap exceeded. This account has ${Math.round(user.storageCapBytes / 1024 / 1024)} MB for project files.`,
    );
  }
}

/**
 * Write a file into a project.
 *
 * `library` selects which storage budget the write is charged against — the
 * shared library cap rather than the project cap. It does **not** rewrite the
 * path: the library is a project of its own (`ensureLibraryProject`), so its
 * files are stored under their real path and served from
 * `/{user}/library/…`. The old `library/` path prefix existed only because the
 * library used to be a folder inside somebody's project.
 */
export async function putFile(
  userId: number,
  projectId: number,
  path: string,
  content: Buffer,
  library = false,
): Promise<FileRecord> {
  await requireOwnedProject(userId, projectId);
  if (path.length > 512 || path.includes("..") || path.startsWith("/")) {
    throw new ApiError("bad_request", "Invalid file path.");
  }
  const isLibrary = library;
  const storedPath = path;
  const db = getDb();
  const p = db.driver;
  const isText = TEXT_EXTENSIONS.test(path);
  const contentText = isText ? content.toString("utf8") : null;
  const sizeBytes = content.byteLength;

  // §8.4: the cap check and the write are one serialized step. Checking before
  // the lock let two concurrent uploads both observe room for themselves and
  // then both land, overshooting the account cap.
  return withProjectWriteLock(projectId, async () => {
    await assertStorageCap(userId, sizeBytes, { library: isLibrary });
    // Upsert on (project_id, path).
    const existing = await db.raw<{ id: number }>(
      `SELECT id FROM files WHERE project_id = ${placeholder(p, 0)} AND path = ${placeholder(p, 1)}`,
      [projectId, storedPath],
    );
    // Postgres BOOLEAN rejects integer binds; SQLite INTEGER rejects booleans.
    const isTextValue = p === "sqlite" ? (isText ? 1 : 0) : isText;
    if (existing[0]) {
      await db.run(
        `UPDATE files SET content_text = ${placeholder(p, 0)}, content_blob = ${placeholder(p, 1)},
         size_bytes = ${placeholder(p, 2)}, is_text = ${placeholder(p, 3)}, updated_at = ${placeholder(p, 4)}
       WHERE id = ${placeholder(p, 5)}`,
        [contentText, content, sizeBytes, isTextValue, new Date().toISOString(), existing[0].id],
      );
      invalidateAsset(projectId, storedPath);
      return (await getFile(projectId, storedPath))!;
    }
    const insertedId = await insertReturningId(
      "files",
      ["project_id", "path", "content_text", "content_blob", "size_bytes", "is_text"],
      [projectId, storedPath, contentText, content, sizeBytes, isTextValue],
    );
    void insertedId;
    invalidateAsset(projectId, storedPath);
    return (await getFile(projectId, storedPath))!;
  });
}

export async function getFile(projectId: number, path: string): Promise<FileRecord | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, project_id, path, is_text, content_text, size_bytes, updated_at
     FROM files WHERE project_id = ${placeholder(p, 0)} AND path = ${placeholder(p, 1)}`,
    [projectId, path],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    path: String(row.path),
    isText: row.is_text === 1 || row.is_text === true,
    contentText: (row.content_text as string | null) ?? null,
    sizeBytes: Number(row.size_bytes ?? 0),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getFileBlob(projectId: number, path: string): Promise<{ record: FileRecord; content: Buffer } | null> {
  const record = await getFile(projectId, path);
  if (!record) return null;
  const db = getDb();
  const rows = await db.raw<{ content_blob: Buffer }>(
    `SELECT content_blob FROM files WHERE id = ${placeholder(db.driver, 0)}`,
    [record.id],
  );
  return { record, content: Buffer.from(rows[0]?.content_blob ?? Buffer.alloc(0)) };
}

export async function listFiles(projectId: number, dir = ""): Promise<FileRecord[]> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, project_id, path, is_text, content_text, size_bytes, updated_at
     FROM files WHERE project_id = ${placeholder(p, 0)} ORDER BY path`,
    [projectId],
  );
  const prefix = dir ? `${dir.replace(/\/+$/, "")}/` : "";
  return rows
    .map((row) => ({
      id: Number(row.id),
      projectId: Number(row.project_id),
      path: String(row.path),
      isText: row.is_text === 1 || row.is_text === true,
      contentText: (row.content_text as string | null) ?? null,
      sizeBytes: Number(row.size_bytes ?? 0),
      updatedAt: String(row.updated_at ?? ""),
    }))
    .filter((f) => f.path.startsWith(prefix) && f.path !== prefix);
}

export async function deleteFile(
  userId: number,
  projectId: number,
  path: string,
  options?: { prefix?: boolean },
): Promise<number> {
  await requireOwnedProject(userId, projectId);
  const db = getDb();
  // Directories are synthesized from file paths by §13.2, so deleting one is
  // deleting everything beneath it. The trailing slash keeps "app" from also
  // matching a sibling file literally named "app".
  const p = (index: number) => placeholder(db.driver, index);
  const result = options?.prefix
    ? await db.run(
        `DELETE FROM files WHERE project_id = ${p(0)} AND (path = ${p(1)} OR path LIKE ${p(2)} ESCAPE '\\')`,
        [projectId, path, `${escapeLike(path)}/%`],
      )
    : await db.run(
        `DELETE FROM files WHERE project_id = ${p(0)} AND path = ${p(1)}`,
        [projectId, path],
      );
  // A deleted file must not be served from the §8.1 cache.
  invalidateAsset(projectId, path);
  if (options?.prefix) invalidateAsset(projectId, `${path}/`);
  return result.changes;
}

/** Escape the LIKE wildcards in a user-supplied path so a `%` stays literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// ---------------------------------------------------------------- helpers

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "23505" || code === "SQLITE_CONSTRAINT_UNIQUE") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|duplicate key value/i.test(message);
}

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

const DEFAULT_STORAGE_CAP = 5_242_880; // 5 MB free tier

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
  try {
    const id = await insertReturningId(
      "users",
      ["username", "password_hash", "email", "storage_cap_bytes"],
      [usernameNorm, passwordHash, email ?? null, DEFAULT_STORAGE_CAP],
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

export async function getUserByUsername(username: string): Promise<(UserRecord & { passwordHash: string }) | null> {
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM users WHERE username = ${placeholder(db.driver, 0)}`,
    [username.trim().toLowerCase()],
  );
  if (!rows[0]) return null;
  const mapped = mapUser(rows[0]);
  return { ...mapped, passwordHash: String(rows[0].password_hash) };
}

/** Verify credentials; updates last_login and rejects suspended accounts. */
export async function authenticateUser(username: string, password: string): Promise<UserRecord> {
  const record = await getUserByUsername(username);
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    throw new ApiError("unauthorized", "Invalid username or password.");
  }
  if (record.isSuspended) {
    throw new ApiError("forbidden", "This account is suspended.");
  }
  const db = getDb();
  await db.run(`UPDATE users SET last_login = ${placeholder(db.driver, 0)} WHERE id = ${placeholder(db.driver, 1)}`, [
    new Date().toISOString(),
    record.id,
  ]);
  return record;
}

// ---------------------------------------------------------------- projects

export interface ProjectRecord {
  id: number;
  userId: number;
  name: string;
  storageAllocatedBytes: number;
  freeVisitsPerMonth: number;
  isActive: boolean;
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
    createdAt: String(row.created_at ?? ""),
  };
}

export async function createProject(userId: number, name: string): Promise<ProjectRecord> {
  const nameNorm = name.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(nameNorm)) {
    throw new ApiError("bad_request", "Project name must be 1-63 chars: a-z, 0-9, _ or - (starting letter/digit).");
  }
  try {
    const id = await insertReturningId("projects", ["user_id", "name"], [userId, nameNorm]);
    return (await getProjectById(id))!;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("conflict", "You already have a project with that name.");
    }
    throw error;
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

// ---------------------------------------------------------------- api keys

export interface ApiKeyRecord {
  id: number;
  projectId: number;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

const KEY_PREFIX_LEN = 12;

/** Generate `sk_<43 chars>`; only the SHA-256 hash is stored. */
export async function createApiKey(userId: number, projectId: number, name: string): Promise<{ record: ApiKeyRecord; key: string }> {
  await requireOwnedProject(userId, projectId);
  const key = `sk_${generateToken(32)}`;
  const db = getDb();
  const p = db.driver;
  const id = await insertReturningId(
    "api_keys",
    ["project_id", "name", "key_hash", "prefix"],
    [projectId, name.trim() || "default", hashToken(key), key.slice(0, KEY_PREFIX_LEN)],
  );
  void p;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_keys WHERE id = ${placeholder(p, 0)}`,
    [id],
  );
  const row = rows[0]!;
  return {
    key,
    record: {
      id: Number(row.id),
      projectId: Number(row.project_id),
      name: String(row.name),
      prefix: String(row.prefix),
      createdAt: String(row.created_at ?? ""),
      revokedAt: (row.revoked_at as string | null) ?? null,
    },
  };
}

/** Resolve an API key to its project, or null. Updates last_used_at. */
export async function resolveApiKey(key: string): Promise<ApiKeyRecord | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_keys WHERE key_hash = ${placeholder(p, 0)} AND revoked_at IS NULL`,
    [hashToken(key)],
  );
  const row = rows[0];
  if (!row) return null;
  await db.run(`UPDATE api_keys SET last_used_at = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`, [
    new Date().toISOString(),
    Number(row.id),
  ]);
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
    prefix: String(row.prefix),
    createdAt: String(row.created_at ?? ""),
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
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

export async function fileSizeFor(path: string, content: Buffer): Promise<number> {
  void path;
  return content.byteLength;
}

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
 * Enforce the account storage cap before any write. `incomingBytes` is added
 * to current usage and compared against the user's cap (402 when over, per the
 * documented payment-required semantics).
 */
export async function assertStorageCap(userId: number, incomingBytes: number): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new ApiError("unauthorized", "Sign in required.");
  const used = await storageUsedBytes(userId);
  if (used + incomingBytes > user.storageCapBytes) {
    throw new ApiError("payment_required", "Storage cap exceeded. Free tier: 5 MB.");
  }
}

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
  const storedPath = isLibrary ? `library/${path}` : path;
  await assertStorageCap(userId, content.byteLength);
  const db = getDb();
  const p = db.driver;
  const isText = TEXT_EXTENSIONS.test(path);
  const contentText = isText ? content.toString("utf8") : null;
  const sizeBytes = content.byteLength;

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
    return (await getFile(projectId, storedPath))!;
  }
  const insertedId = await insertReturningId(
    "files",
    ["project_id", "path", "content_text", "content_blob", "size_bytes", "is_text"],
    [projectId, storedPath, contentText, content, sizeBytes, isTextValue],
  );
  void insertedId;
  return (await getFile(projectId, storedPath))!;
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

export async function deleteFile(userId: number, projectId: number, path: string): Promise<number> {
  await requireOwnedProject(userId, projectId);
  const db = getDb();
  const result = await db.run(
    `DELETE FROM files WHERE project_id = ${placeholder(db.driver, 0)} AND path = ${placeholder(db.driver, 1)}`,
    [projectId, path],
  );
  return result.changes;
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

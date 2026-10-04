/**
 * Admin endpoints and file serving for the curated public library (§5.3).
 */
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { deleteFile, listFiles, putFile } from "@/lib/server/repos";
import { sanitizeRelativePath } from "@/lib/server/storage-routes";
import { log, requireOperator } from "./common";

export const PUBLIC_LIBRARY_PROJECT = "public-library";
export const PUBLIC_LIBRARY_PREFIX = "library/public/";

/**
 * The admin's curated public library (§5.3) lives in the admin's own
 * `public-library` project, under `library/public/…`, and is served at
 * /~public/<path>.
 */
export async function publicLibraryProject(create: boolean) {
  const db = getDb();
  const rows = await db.raw<{ id: number; user_id: number }>(
    `SELECT pr.id, pr.user_id FROM projects pr JOIN users u ON u.id = pr.user_id
     WHERE u.is_admin = ${db.driver === "sqlite" ? 1 : "TRUE"} AND pr.name = ${placeholder(db.driver, 0)}
     ORDER BY pr.id LIMIT 1`,
    [PUBLIC_LIBRARY_PROJECT],
  );
  if (rows[0]) return { id: Number(rows[0].id), userId: Number(rows[0].user_id) };
  if (!create) return null;
  const admin = await db.raw<{ id: number }>(
    `SELECT id FROM users WHERE is_admin = ${db.driver === "sqlite" ? 1 : "TRUE"} ORDER BY id LIMIT 1`,
  );
  if (!admin[0]) throw new ApiError("forbidden", "No admin account exists.");
  const { createProject } = await import("@/lib/server/repos");
  const project = await createProject(Number(admin[0].id), PUBLIC_LIBRARY_PROJECT);
  return { id: project.id, userId: project.userId };
}

/** GET /api/admin/public-library — assets served from /~public/. */
export const adminPublicLibraryList = handler(async (request) => {
  await requireOperator(request);
  const project = await publicLibraryProject(false);
  if (!project) return apiOk({ data: [] });
  const files = await listFiles(project.id, PUBLIC_LIBRARY_PREFIX);
  return apiOk({
    data: files.map((file) => ({
      path: file.path.slice(PUBLIC_LIBRARY_PREFIX.length),
      size: file.sizeBytes,
      modified: file.updatedAt,
    })),
  });
});

/** PUT /api/admin/public-library?path=theme.css — raw body upload. */
export const adminPublicLibraryPut = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  if (/\.html?$/i.test(path)) throw new ApiError("bad_request", "HTML files cannot be published.");
  const resolved = await publicLibraryProject(true);
  if (!resolved) throw new ApiError("internal_error", "Could not prepare the public library project.");
  const content = Buffer.from(await request.arrayBuffer());
  const record = await putFile(
    resolved.userId,
    resolved.id,
    `${PUBLIC_LIBRARY_PREFIX}${path}`,
    content,
    true,
  );
  log.info("admin.public_library_published", { path, size: record.sizeBytes });
  return apiOk({ success: true, path: `/~public/${path}`, size: record.sizeBytes }, { status: 201 });
});

/** DELETE /api/admin/public-library?path=theme.css */
export const adminPublicLibraryDelete = handler(async (request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  const project = await publicLibraryProject(false);
  if (!project) throw new ApiError("not_found", "Public library is empty.");
  const removed = await deleteFile(project.userId, project.id, `${PUBLIC_LIBRARY_PREFIX}${path}`);
  if (removed === 0) throw new ApiError("not_found", "File not found.");
  log.info("admin.public_library_removed", { path });
  return apiOk({ success: true });
});

/** Resolve the admin public-library file for /~public/<path> serving. */
export async function readPublicLibraryFile(
  path: string,
): Promise<{ content: Buffer; projectId: number } | null> {
  const db = getDb();
  const stored = `${PUBLIC_LIBRARY_PREFIX}${path}`;
  const rows = await db.raw<{ content_text: string | null; content_blob: Buffer | null; project_id: number }>(
    `SELECT f.content_text, f.content_blob, f.project_id FROM files f
     JOIN projects pr ON pr.id = f.project_id JOIN users u ON u.id = pr.user_id
     WHERE u.is_admin = ${db.driver === "sqlite" ? 1 : "TRUE"} AND pr.name = ${placeholder(db.driver, 0)} AND f.path = ${placeholder(db.driver, 1)}
     LIMIT 1`,
    [PUBLIC_LIBRARY_PROJECT, stored],
  );
  const row = rows[0];
  if (!row) return null;
  const content = row.content_text != null
    ? Buffer.from(String(row.content_text), "utf8")
    : Buffer.from(row.content_blob ?? Buffer.alloc(0));
  return { content, projectId: Number(row.project_id) };
}

/**
 * The shared asset library (Blueprint §5.3) — a plain CDN namespace.
 *
 * Every account has a reserved project named `library`, and its files are served
 * at `/{username}/library/<path>`. Uploading an asset once makes that URL
 * available to every project the account owns; a project references it with an
 * ordinary link and nothing is copied between projects.
 *
 * This replaced a flow that made the caller choose a "home project" for the
 * upload and then reason about copies: the same asset could exist in several
 * projects, the console had to show a ×N badge, and deleting it had to clean up
 * every copy. One namespace, one file, one URL.
 *
 * HTML is rejected here: library assets are served from the platform origin, so
 * a stored .html would run scripts against the owner's own console session. A
 * project page can still host HTML in its Code tab.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  deleteFile,
  ensureLibraryProject,
  listFiles,
  LIBRARY_PROJECT_NAME,
  putFile,
} from "@/lib/server/repos";
import { sanitizeRelativePath } from "@/lib/server/storage-routes";
import { setting } from "@/lib/server/system-config";
import { createLogger } from "@/lib/server/logger";
import { siteOrigin } from "@/lib/seo";

const log = createLogger("library");

export interface LibraryEntry {
  path: string;
  size: number;
  modified: string;
}

export interface LibraryUsage {
  used: number;
  cap: number;
}

/** Every asset in the account's library, as a flat sorted list. */
export async function listLibraryForUser(userId: number): Promise<LibraryEntry[]> {
  const library = await ensureLibraryProject(userId);
  const files = await listFiles(library.id);
  return files
    .map((file) => ({
      path: file.path,
      size: file.sizeBytes,
      modified: file.updatedAt,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Bytes used by the library and the absolute cap that applies to them.
 *
 * The library is its own budget rather than a bonus on the project cap, so the
 * allowance a user is shown is one number they can reason about.
 */
export async function libraryUsage(userId: number): Promise<LibraryUsage> {
  const library = await ensureLibraryProject(userId);
  const db = getDb();
  const rows = await db.raw<{ total: number | string }>(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files
     WHERE project_id = ${placeholder(db.driver, 0)}`,
    [library.id],
  );
  return { used: Number(rows[0]?.total ?? 0), cap: await setting("storage.library_cap_bytes") };
}

const uploadSchema = z.object({
  path: z.string().min(1),
  /** Base64 so binary assets survive JSON; the client reads the file itself. */
  contentBase64: z.string().min(1),
});

export const libraryList = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const [entries, usage] = await Promise.all([
    listLibraryForUser(principal.userId!),
    libraryUsage(principal.userId!),
  ]);
  return apiOk({
    data: entries,
    usage,
    username: principal.username,
    /** The prefix every reference uses, e.g. "/ada/library". */
    publicUrl: `/${principal.username}/${LIBRARY_PROJECT_NAME}`,
  });
});

export const libraryUpload = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const body = await parseJson(request, uploadSchema);
  const path = sanitizeRelativePath(body.path);
  if (/\.html?$/i.test(path)) {
    throw new ApiError("bad_request", "HTML files cannot be published to the library.");
  }
  const library = await ensureLibraryProject(principal.userId!);
  const content = Buffer.from(body.contentBase64, "base64");

  // Re-uploading a file that is already there replaces it, so the bytes it
  // frees must not count against the cap or a re-save could become impossible.
  const existing = (await listLibraryForUser(principal.userId!)).find((entry) => entry.path === path);
  const usage = await libraryUsage(principal.userId!);
  if (usage.used - (existing?.size ?? 0) + content.byteLength > usage.cap) {
    throw new ApiError(
      "payment_required",
      `Library cap exceeded — this account has ${Math.round(usage.cap / 1024 / 1024)} MB for shared assets.`,
    );
  }

  const record = await putFile(principal.userId!, library.id, path, content, true);
  log.info("library.uploaded", { userId: principal.userId, path, size: record.sizeBytes });
  return apiOk(
    {
      success: true,
      path,
      size: record.sizeBytes,
      url: `/${principal.username}/${LIBRARY_PROJECT_NAME}/${path}`,
    },
    { status: 201 },
  );
});

export const libraryDelete = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const path = sanitizeRelativePath(new URL(request.url).searchParams.get("path") ?? "");
  const library = await ensureLibraryProject(principal.userId!);
  const removed = await deleteFile(principal.userId!, library.id, path, { prefix: true });
  if (removed === 0) throw new ApiError("not_found", "Asset not found.");
  log.info("library.deleted", { userId: principal.userId, path, removed });
  return apiOk({ success: true, removed });
});

/** Absolute origin of the library, used by the console's copy-URL helper. */
export function libraryOrigin(): string {
  return siteOrigin();
}

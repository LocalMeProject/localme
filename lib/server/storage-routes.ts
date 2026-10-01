/**
 * Shared logic for /api/storage/* and /api/lib/* (docs §13.2-§13.3).
 *
 * The two are the same file store pointed at different namespaces: `/api/storage/*`
 * addresses a project, `/api/lib/*` (`lib=1`) addresses the account's shared
 * library, which is its own reserved project served from `/{user}/library/…`.
 * HTML is refused in the library per the Blueprint's rules.
 */
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { z } from "zod";
import { logger as log } from "@/lib/server/logger";
import { requirePermission, requirePrincipal, requireProjectScoped, requireSessionUser } from "@/lib/server/api-auth";
import { deleteFile, getFileBlob, listFiles, putFile, getUserById, LIBRARY_PROJECT_NAME, ensureLibraryProject } from "@/lib/server/repos";
import { dispatchWebhookEvent } from "@/lib/server/webhook-routes";
import { setting, settingFlag } from "@/lib/server/system-config";
import { assetKindFor, minifyAsset } from "@/lib/server/minify";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // documented default (§10 storage.max_upload_size_bytes)

export function sanitizeRelativePath(raw: string): string {
  const cleaned = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleaned || cleaned.includes("..") || cleaned.length > 512) {
    throw new ApiError("bad_request", "Invalid path.");
  }
  return cleaned;
}

/**
 * Refuse a project file under the reserved top-level `library/` folder.
 *
 * `library` is the account's shared asset namespace, served from
 * `/{user}/library/…`. A project file stored at the same relative path would
 * silently lose to (or shadow) the shared asset depending on lookup order, so
 * the name is refused outright with a pointer to the real place to put it.
 */
export function assertNotReservedFolder(path: string): void {
  const [top] = path.split("/");
  if (top && top.toLowerCase() === LIBRARY_PROJECT_NAME) {
    throw new ApiError(
      "bad_request",
      "“library” is reserved for your shared assets. Upload it from the Library page and reference /{username}/library/…",
    );
  }
}

/**
 * Resolve the project a call targets and enforce its granular permission.
 *
 * `lib=1` selects the account's shared library instead of a project: the library
 * is a project of its own now, so the documented `/api/lib/*` mirror of
 * `/api/storage/*` keeps working while addressing the same namespace that
 * `/{user}/library/…` serves. A console session owns it outright.
 */
async function scopedProject(request: Request, permission: string, library = false) {
  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId");
  if (library) {
    const principal = await requireSessionUser(request);
    requirePermission(principal, permission);
    return await ensureLibraryProject(principal.userId!);
  }
  // The visitor cookie is `auth_{projectId}`, so the target project is needed to
  // resolve the caller at all; a signed-in visitor is a first-class caller here.
  const hint = /^\d+$/.test(projectIdParam ?? "") ? Number(projectIdParam) : null;
  const principal = await requirePrincipal(request, hint);
  const project = await requireProjectScoped(request, principal, projectIdParam);
  requirePermission(principal, permission);
  return project;
}

/**
 * Reject a body whose declared size already exceeds the upload cap, before the
 * body is read into memory (§8.3). A missing or lying Content-Length is caught
 * by the post-read size check instead.
 */
async function assertDeclaredSize(request: Request, declaredBytes: number): Promise<void> {
  if (!Number.isFinite(declaredBytes) || declaredBytes <= 0) return;
  const maxFileBytes = (await setting("storage.max_upload_size_bytes")) || MAX_FILE_BYTES;
  if (declaredBytes > maxFileBytes) {
    throw new ApiError("payload_too_large", `Files are limited to ${Math.round(maxFileBytes / 1024 / 1024)} MB.`);
  }
}

export const storageUpload = handler(async (request: Request) => {
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const project = await scopedProject(request, library ? "lib_write" : "storage_write", library);
  const userId = project.userId;

  const contentType = request.headers.get("content-type") ?? "";
  let path: string;
  let content: Buffer;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("bad_request", "Missing file field.");
    const rawPath = (form.get("path") as string | null) ?? file.name;
    path = sanitizeRelativePath(rawPath);
    await assertDeclaredSize(request, file.size);
    content = Buffer.from(await file.arrayBuffer());
  } else {
    path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
    // §8.3: refuse an oversized body from its Content-Length before buffering it,
    // so a large upload is rejected without ever being held in memory.
    await assertDeclaredSize(request, Number(request.headers.get("content-length") ?? "0"));
    content = Buffer.from(await request.arrayBuffer());
  }

  const maxFileBytes = await setting("storage.max_upload_size_bytes") || MAX_FILE_BYTES;
  if (content.byteLength > maxFileBytes) {
    throw new ApiError("payload_too_large", `Files are limited to ${Math.round(maxFileBytes / 1024 / 1024)} MB.`);
  }
  if (library && /\.html?$/i.test(path)) {
    throw new ApiError("bad_request", "HTML files cannot be stored in the library.");
  }
  // Project files may not squat the reserved shared-library folder.
  if (!library) assertNotReservedFolder(path);

  // §8.3 "Minification on save (HTML/CSS/JS)": on by default via
  // storage.minify_on_save, with ?minify=0 to store the bytes as uploaded and
  // ?minify=1 to force it for a client that wants to be explicit.
  const kind = assetKindFor(path);
  if (kind) {
    const forced = url.searchParams.get("minify");
    const enabled = forced === "1" ? true : forced === "0" ? false : await settingFlag("storage.minify_on_save");
    if (enabled) {
      const text = content.toString("utf8");
      const minified = minifyAsset(path, text);
      if (minified.length > 0 && minified.length < text.length) content = Buffer.from(minified, "utf8");
    }
  }

  let record;
  try {
    record = await putFile(userId, project.id, path, content, library);
  } catch (error) {
    if (error instanceof ApiError && error.code === "payment_required") {
      void dispatchWebhookEvent(project.id, "storage.cap_exceeded", {
        path: `/${path}`,
        size: content.byteLength,
      }).catch(() => undefined);
    }
    throw error;
  }
  if (!library) {
    void dispatchWebhookEvent(project.id, "storage.uploaded", {
      path: `/${path}`,
      size: record.sizeBytes,
    }).catch(() => undefined);
  }
  return apiOk({ success: true, path: `/${path}`, size: record.sizeBytes }, { status: 201 });
});

export const storageList = handler(async (request: Request) => {
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const project = await scopedProject(request, library ? "lib_read" : "storage_read", library);
  const rawPath = url.searchParams.get("path") ?? "";
  // Empty path lists everything; a given path lists that directory.
  const dir = rawPath === "" ? "" : sanitizeRelativePath(rawPath);
  const prefix = dir;
  const files = await listFiles(project.id, prefix);
  const directoryPrefix = dir ? `${dir.replace(/\/+$/, "")}/` : "";
  const entries = files.map((f) => {
    const entryPath = f.path;
    return {
      path: entryPath,
      name: entryPath.split("/").pop() ?? entryPath,
      size: f.sizeBytes,
      modified: f.updatedAt,
      type: "file" as const,
    };
  });
  // §13.2 also lists directories; synthesize them from the file paths.
  const directories = new Set<string>();
  for (const entry of entries) {
    const relative = entry.path.startsWith(directoryPrefix) ? entry.path.slice(directoryPrefix.length) : entry.path;
    const slash = relative.indexOf("/");
    if (slash > 0) directories.add(relative.slice(0, slash) || ".");
  }
  const data = [
    ...[...directories].sort().map((name) => ({
      path: `${directoryPrefix}${name}`,
      name,
      size: 0,
      modified: "",
      type: "directory" as const,
    })),
    ...entries,
  ];
  return apiOk({ data });
});

export const storageDownload = handler(async (request: Request) => {
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const project = await scopedProject(request, library ? "lib_read" : "storage_read", library);
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  const found = await getFileBlob(project.id, path);
  if (!found) throw new ApiError("not_found", "File not found.");

  const asDownload = url.searchParams.get("download") === "1";
  const body = new Uint8Array(found.content);
  return new Response(body, {
    status: 200,
    headers: {
      // Stored text keeps its own type, except HTML: a download served as
      // text/html from the platform origin would be stored XSS against the
      // console session, whatever the disposition says. It is served as text
      // with nosniff instead, which is also what the editor wants.
      "content-type": found.record.isText
        ? contentTypeForDownload(path)
        : "application/octet-stream",
      "x-content-type-options": "nosniff",
      "content-disposition": `${asDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(path.split("/").pop() ?? "file")}"`,
    },
  }) as unknown as import("next/server").NextResponse;
});

/**
 * Content type for a stored text file.
 *
 * HTML deliberately maps to `text/plain` even though its extension says
 * otherwise. `/api/storage/download` runs on the platform origin, so returning
 * `text/html` here would let any project owner who uploads an `.html` file run
 * script against a console session on that origin. Paired with `nosniff` this
 * is inert; the console editor reads the bytes regardless.
 */
function contentTypeForDownload(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "text/plain; charset=utf-8";
  const known: Record<string, string> = {
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    webmanifest: "application/manifest+json",
    xml: "application/xml; charset=utf-8",
    md: "text/markdown; charset=utf-8",
  };
  return known[ext] ?? "text/plain; charset=utf-8";
}

export const storageDelete = handler(async (request: Request) => {
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const project = await scopedProject(request, library ? "lib_write" : "storage_write", library);
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  const userId = project.userId;
  // ?prefix=1 turns a directory row from the §13.2 listing into "delete
  // everything under here", which is what a file manager's folder trash does.
  const prefix = url.searchParams.get("prefix") === "1";
  const deleted = await deleteFile(userId, project.id, path, { prefix });
  if (deleted === 0) throw new ApiError("not_found", "File not found.");
  return apiOk({ success: true, deleted });
});

const moveSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

/**
 * POST /api/storage/move — rename or relocate one stored file.
 *
 * There is no blob rewrite to avoid: files are small (§8.3 caps uploads at
 * 10 MB by default), so the bytes are read once, written under the new path and
 * the old row removed. Doing it as write-then-delete means an interrupted move
 * can duplicate a file but can never lose one.
 */
export const storageMove = handler(async (request: Request) => {
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const project = await scopedProject(request, library ? "lib_write" : "storage_write", library);
  const body = await parseJson(request, moveSchema);
  const from = sanitizeRelativePath(body.from);
  const to = sanitizeRelativePath(body.to);
  if (from === to) throw new ApiError("bad_request", "Source and destination are the same.");
  if (to.startsWith(`${from}/`)) {
    throw new ApiError("bad_request", "Cannot move a folder into itself.");
  }
  if (!library) {
    assertNotReservedFolder(from);
    assertNotReservedFolder(to);
  }
  const found = await getFileBlob(project.id, from);
  if (!found) throw new ApiError("not_found", "File not found.");
  await putFile(project.userId, project.id, to, found.content, library);
  await deleteFile(project.userId, project.id, from);
  log.info("storage.moved", { projectId: project.id, from, to });
  return apiOk({ success: true, path: `/${to}` });
});

export const storageStatus = handler(async (request: Request) => {
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const project = await scopedProject(request, library ? "lib_read" : "storage_read");
  const user = await getUserById(project.userId);
  if (!user) throw new ApiError("unauthorized", "Sign in required.");
  const files = await listFiles(project.id, "");
  return apiOk({
    used: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    total: user.storageCapBytes,
    files: files.length,
  });
});

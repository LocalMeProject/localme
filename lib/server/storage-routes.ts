/**
 * Shared logic for /api/storage/* and /api/lib/* (docs §13.2-13.3). The library
 * is the same file store under a `library/` path prefix; HTML is rejected there
 * per the Blueprint's library rules.
 */
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { deleteFile, getFileBlob, listFiles, putFile, getUserById } from "@/lib/server/repos";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const LIBRARY_PREFIX = "library/";

export function sanitizeRelativePath(raw: string): string {
  const cleaned = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleaned || cleaned.includes("..") || cleaned.length > 512) {
    throw new ApiError("bad_request", "Invalid path.");
  }
  return cleaned;
}

async function scopedProject(request: Request) {
  const principal = await requirePrincipal(request);
  const url = new URL(request.url);
  return requireProjectScoped(request, principal, url.searchParams.get("projectId"));
}

function fullStoragePath(projectPath: string, library: boolean): string {
  return library ? `${LIBRARY_PREFIX}${projectPath}` : projectPath;
}

function splitStoragePath(storedPath: string): { projectPath: string; library: boolean } {
  if (storedPath.startsWith(LIBRARY_PREFIX)) {
    return { projectPath: storedPath.slice(LIBRARY_PREFIX.length), library: true };
  }
  return { projectPath: storedPath, library: false };
}

export const storageUpload = handler(async (request: Request) => {
  const project = await scopedProject(request);
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const userId = await ownerUserId(project.userId);

  const contentType = request.headers.get("content-type") ?? "";
  let path: string;
  let content: Buffer;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("bad_request", "Missing file field.");
    const rawPath = (form.get("path") as string | null) ?? file.name;
    path = sanitizeRelativePath(rawPath);
    content = Buffer.from(await file.arrayBuffer());
  } else {
    path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
    content = Buffer.from(await request.arrayBuffer());
  }

  if (content.byteLength > MAX_FILE_BYTES) {
    throw new ApiError("bad_request", "Files are limited to 10 MB.");
  }
  if (library && /\.html?$/i.test(path)) {
    throw new ApiError("bad_request", "HTML files cannot be stored in the library.");
  }

  const record = await putFile(userId, project.id, fullStoragePath(path, library), content, false);
  return apiOk({ success: true, path: `/${path}`, size: record.sizeBytes }, { status: 201 });
});

export const storageList = handler(async (request: Request) => {
  const project = await scopedProject(request);
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const dir = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  const prefix = library ? `${LIBRARY_PREFIX}${dir}` : dir;
  const files = await listFiles(project.id, prefix);
  return apiOk({
    data: files.map((f) => ({
      path: splitStoragePath(f.path).projectPath,
      size: f.sizeBytes,
      modified: f.updatedAt,
      type: "file",
    })),
  });
});

export const storageDownload = handler(async (request: Request) => {
  const project = await scopedProject(request);
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? "");
  const found = await getFileBlob(project.id, fullStoragePath(path, library));
  if (!found) throw new ApiError("not_found", "File not found.");

  const asDownload = url.searchParams.get("download") === "1";
  const body = new Uint8Array(found.content);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": found.record.isText ? "text/plain; charset=utf-8" : "application/octet-stream",
      "content-disposition": `${asDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(path.split("/").pop() ?? "file")}"`,
    },
  }) as unknown as import("next/server").NextResponse;
});

export const storageDelete = handler(async (request: Request) => {
  const project = await scopedProject(request);
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const path = sanitizeRelativePath(url.searchParams.get("path") ?? url.searchParams.get("bodyPath") ?? "");
  const userId = await ownerUserId(project.userId);
  const deleted = await deleteFile(userId, project.id, fullStoragePath(path, library));
  if (deleted === 0) throw new ApiError("not_found", "File not found.");
  return apiOk({ success: true });
});

export const storageStatus = handler(async (request: Request) => {
  const project = await scopedProject(request);
  const url = new URL(request.url);
  const library = url.searchParams.get("lib") === "1";
  const user = await getUserById(project.userId);
  if (!user) throw new ApiError("unauthorized", "Sign in required.");
  const files = await listFiles(project.id, library ? LIBRARY_PREFIX : "");
  return apiOk({
    used: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    total: user.storageCapBytes,
    files: files.length,
  });
});

async function ownerUserId(projectOwner: number): Promise<number> {
  return projectOwner;
}

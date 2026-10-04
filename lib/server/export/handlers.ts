/**
 * HTTP route handlers for export and import endpoints.
 */
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { deleteFile, ensureLibraryProject, listFiles, putFile } from "@/lib/server/repos";
import { readZip } from "@/lib/server/zip";
import { EXPORT_FEATURES, ownerProject } from "./common";
import { exportFeature } from "./export-feature";
import { featureFromParam, importFeature } from "./import-feature";
import {
  MAX_IMPORT_BYTES,
  buildProjectExport,
  maxImportBytes,
  parseJsonSection,
} from "./archive";

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
  let libraryMode = url.searchParams.get("libraryMode"); // 'overwrite' | 'append' | 'skip'
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("bad_request", "Missing file field.");
    archive = Buffer.from(await file.arrayBuffer());
    if (!libraryMode) {
      const modeField = form.get("libraryMode");
      if (typeof modeField === "string") libraryMode = modeField;
    }
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

  const libraryEntries = entries.filter(
    (e) => e.path.startsWith("library/") || e.path.startsWith("lib/"),
  );
  const libraryProject = await ensureLibraryProject(principal.userId!);
  const existingLibFiles = await listFiles(libraryProject.id, "");

  // If library already has assets and archive contains library files, prompt for confirmation (409)
  if (existingLibFiles.length > 0 && libraryEntries.length > 0 && !libraryMode) {
    return new Response(
      JSON.stringify({
        error: "library_conflict",
        conflict: "library_populated",
        message: "Your library already contains files. Please specify libraryMode ('overwrite', 'append', or 'skip').",
        existingCount: existingLibFiles.length,
        archiveCount: libraryEntries.length,
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    ) as unknown as import("next/server").NextResponse;
  }

  // In overwrite mode, clear the old library completely before writing new assets
  if (libraryMode === "overwrite" && libraryEntries.length > 0) {
    for (const f of existingLibFiles) {
      await deleteFile(principal.userId!, libraryProject.id, f.path);
    }
  }

  let files = 0;
  let skipped = 0;
  for (const entry of entries) {
    const isLibrary = entry.path.startsWith("library/") || entry.path.startsWith("lib/");
    if (isLibrary && libraryMode === "skip") {
      skipped += 1;
      continue;
    }

    const target = isLibrary
      ? {
          path: entry.path.startsWith("library/")
            ? entry.path.slice("library/".length)
            : entry.path.slice("lib/".length),
          library: true,
          destProjectId: libraryProject.id,
        }
      : entry.path.startsWith("storage/")
        ? { path: entry.path.slice("storage/".length), library: false, destProjectId: project.id }
        : null;

    if (!target) continue;
    // A hostile archive must not abort the whole restore, and putFile refuses
    // traversal paths anyway — count them so the caller can see what happened.
    if (!target.path || target.path.length > 512 || target.path.includes("..") || target.path.startsWith("/")) {
      skipped += 1;
      continue;
    }
    await putFile(principal.userId!, target.destProjectId, target.path, entry.content, target.library);
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

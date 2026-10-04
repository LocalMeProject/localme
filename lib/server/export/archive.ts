/**
 * Project archive zip packaging, limit calculation, and json section parsing.
 */
import { ApiError } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  ensureLibraryProject,
  getFileBlob,
  getProjectById,
  getUserById,
  listFiles,
} from "@/lib/server/repos";
import { buildZip } from "@/lib/server/zip";
import { bool } from "./common";
import { exportConfigBundle, parseArray } from "./export-feature";

/**
 * Upper bound on one import archive. A full export of a project can never exceed
 * the owner's storage cap, so the cap is the natural limit; the extra headroom
 * covers the ZIP framing and the clear-text config/secrets sections.
 */
export const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

export async function maxImportBytes(userId: number): Promise<number> {
  const user = await getUserById(userId);
  const cap = Number(user?.storageCapBytes ?? 0);
  return cap > 0 ? Math.min(cap * 2, MAX_IMPORT_BYTES) : MAX_IMPORT_BYTES;
}

/** Parse a JSON section of an archive, reporting a 400 instead of a 500. */
export function parseJsonSection<T>(entry: { path: string; content: Buffer }, label: string): T {
  try {
    return JSON.parse(entry.content.toString("utf8")) as T;
  } catch {
    throw new ApiError("bad_request", `${label} is not valid JSON.`);
  }
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
    entries.push({ path: `storage/${file.path}`, content: found.content });
  }

  // Include user's shared asset library under library/ (Blueprint §5.10 / §1.12)
  const project = await getProjectById(projectId);
  if (project) {
    const libraryProject = await ensureLibraryProject(project.userId);
    const libFiles = await listFiles(libraryProject.id, "");
    for (const file of libFiles) {
      const found = await getFileBlob(libraryProject.id, file.path);
      if (!found) continue;
      entries.push({ path: `library/${file.path}`, content: found.content });
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

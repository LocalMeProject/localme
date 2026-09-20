/**
 * Shared logic for /api/secrets (CRUD) and /api/secrets/get (Blueprint §6.2-6.3).
 * Values are sealed with AES-256-GCM (secrets-crypto.ts) before storage; the
 * plaintext is only ever returned by /api/secrets/get to the project owner.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets-crypto";

const KEY_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

const upsertSchema = z.object({
  key: z.string().regex(KEY_NAME),
  value: z.string().min(1).max(64_000),
});

const getSchema = z.object({ key: z.string().regex(KEY_NAME) });

async function scopedProject(request: Request, projectIdParam: string | null) {
  // Owner/admin sessions and project-pinned API keys both manage secrets.
  const principal = await requirePrincipal(request);
  return requireProjectScoped(request, principal, projectIdParam);
}

/** GET /api/secrets?projectId=N — key names + timestamps only, never values. */
export const secretsList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT key_name, created_at, updated_at FROM secrets
     WHERE project_id = ${placeholder(p, 0)} ORDER BY key_name`,
    [project.id],
  );
  return apiOk({
    data: rows.map((r) => ({
      key: String(r.key_name),
      createdAt: String(r.created_at ?? ""),
      updatedAt: String(r.updated_at ?? ""),
    })),
  });
});

/** PUT /api/secrets — create or replace one secret. */
export const secretsUpsert = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, upsertSchema);
  const db = getDb();
  const p = db.driver;
  const sealed = encryptSecret(body.value);
  const now = new Date().toISOString();

  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM secrets WHERE project_id = ${placeholder(p, 0)} AND key_name = ${placeholder(p, 1)}`,
    [project.id, body.key],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE secrets SET encrypted_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
      [sealed, now, existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
      [project.id, body.key, sealed],
    );
  }
  return apiOk({ success: true, key: body.key });
});

/** POST /api/secrets/get — decrypt one secret (owner session only). */
export const secretsGet = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, getSchema);
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<{ encrypted_value: string }>(
    `SELECT encrypted_value FROM secrets
     WHERE project_id = ${placeholder(p, 0)} AND key_name = ${placeholder(p, 1)}`,
    [project.id, body.key],
  );
  if (!rows[0]) throw new ApiError("not_found", "Secret not found.");
  return apiOk({ key: body.key, value: decryptSecret(rows[0].encrypted_value) });
});

/** DELETE /api/secrets?key=NAME&projectId=N */
export const secretsDelete = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const key = url.searchParams.get("key") ?? "";
  if (!KEY_NAME.test(key)) throw new ApiError("bad_request", "Invalid key name.");
  const db = getDb();
  const changes = await db.run(
    `DELETE FROM secrets WHERE project_id = ${placeholder(db.driver, 0)} AND key_name = ${placeholder(db.driver, 1)}`,
    [project.id, key],
  );
  if (changes.changes === 0) throw new ApiError("not_found", "Secret not found.");
  return apiOk({ success: true });
});

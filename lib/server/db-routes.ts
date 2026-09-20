/**
 * Shared logic for /api/db/{find,insert,update,delete} — document operations on
 * the caller's project (Blueprint §6.2, docs §13.1). API keys are pinned to
 * their project; session callers pass ?projectId=.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { createDocumentStore, DuplicateDocumentIdError } from "@/lib/server/db/documents";
import { getDb } from "@/lib/server/db/index";

const findSchema = z.object({
  table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
  filter: z.record(z.string(), z.unknown()).optional(),
  sort: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
});

const insertSchema = z.object({
  table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
  document: z.record(z.string(), z.unknown()),
});

const updateSchema = z.object({
  table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
  filter: z.record(z.string(), z.unknown()).optional(),
  update: z.record(z.string(), z.unknown()),
  many: z.boolean().default(false),
});

const deleteSchema = z.object({
  table: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/),
  filter: z.record(z.string(), z.unknown()).optional(),
});

async function scopedStore(request: Request) {
  const principal = await requirePrincipal(request);
  const url = new URL(request.url);
  const project = await requireProjectScoped(request, principal, url.searchParams.get("projectId"));
  const store = createDocumentStore(getDb());
  return { store, projectId: project.id };
}

export const dbFind = handler(async (request) => {
  const body = await parseJson(request, findSchema);
  const { store, projectId } = await scopedStore(request);
  const result = await store.find(projectId, body.table, body);
  const total = await store.count(projectId, body.table, body.filter);
  return apiOk({ ...result, total });
});

export const dbInsert = handler(async (request) => {
  const body = await parseJson(request, insertSchema);
  const { store, projectId } = await scopedStore(request);
  try {
    const row = await store.insert(projectId, body.table, body.document as Record<string, never>);
    return apiOk({ success: true, id: (row.document as { id?: unknown }).id ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateDocumentIdError) {
      throw new ApiError("conflict", error.message);
    }
    throw error;
  }
});

export const dbUpdate = handler(async (request) => {
  const body = await parseJson(request, updateSchema);
  const { store, projectId } = await scopedStore(request);
  const modified = await store.update(projectId, body.table, body.filter, body.update, body.many);
  return apiOk({ success: true, modified });
});

export const dbDelete = handler(async (request) => {
  const body = await parseJson(request, deleteSchema);
  const { store, projectId } = await scopedStore(request);
  const deleted = await store.delete(projectId, body.table, body.filter);
  return apiOk({ success: true, deleted });
});

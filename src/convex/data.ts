import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  MAX_QUERY_RESULTS,
  MAX_SCAN,
  applyUpdate,
  documentIdOf,
  matchesFilter,
  sortDocuments,
} from "./lib/dsl";
import { fail } from "./lib/errors";
import { assertPermission, principalValidator, type Principal } from "./lib/principal";
import { requireProjectOwnership, requireProjectOwnershipMutation } from "./lib/session";
import { validateTableName } from "./lib/validation";

function asDocument(row: Doc<"projectData">): Record<string, unknown> {
  const document = { ...(row.document as Record<string, unknown>) };
  document._localme = { updatedAt: row.updatedAt, createdAt: row.createdAt };
  return document;
}

function parseJson(value: unknown, label: string): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    fail(`${label} must be valid JSON`, 400, "invalid_json");
  }
}

async function assertPermissionFor(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  permission: Parameters<typeof assertPermission>[1],
  principal: Principal | undefined,
  endpointName: string,
) {
  if (!principal) return;
  const endpoint = await ctx.db
    .query("apiEndpoints")
    .withIndex("by_project_endpoint", (q) =>
      q.eq("projectId", projectId).eq("endpointName", endpointName),
    )
    .unique();
  if (endpoint && !endpoint.isEnabled) {
    fail("This endpoint is disabled for the project", 403, "endpoint_disabled");
  }
  assertPermission(principal, permission);
}

/* ------------------------------------------------------------------ *
 * Core operations (shared by dashboard and HTTP API)
 * ------------------------------------------------------------------ */

export type FindResult = {
  data: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
};

export async function findDocuments(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  args: {
    table: string;
    filter?: unknown;
    sort?: unknown;
    limit?: number;
    offset?: number;
  },
): Promise<FindResult> {
  const table = validateTableName(args.table);
  const filter = parseJson(args.filter, "Filter");
  const sort = parseJson(args.sort, "Sort");
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_QUERY_RESULTS);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await ctx.db
    .query("projectData")
    .withIndex("by_project_table", (q) => q.eq("projectId", projectId).eq("tableName", table))
    .take(MAX_SCAN);
  const matched = rows
    .filter((row) => matchesFilter(row.document as Record<string, unknown>, filter))
    .map(asDocument);
  const sorted = sortDocuments(matched, sort);
  return {
    data: sorted.slice(offset, offset + limit),
    total: sorted.length,
    limit,
    offset,
    truncated: rows.length >= MAX_SCAN,
  };
}

export async function deleteDocuments(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  args: { table: string; filter?: unknown },
): Promise<number> {
  const table = validateTableName(args.table);
  const filter = parseJson(args.filter, "Filter");
  const rows = await ctx.db
    .query("projectData")
    .withIndex("by_project_table", (q) => q.eq("projectId", projectId).eq("tableName", table))
    .take(MAX_SCAN);
  const targets = rows.filter((row) => matchesFilter(row.document as Record<string, unknown>, filter));
  for (const row of targets) await ctx.db.delete(row._id);
  return targets.length;
}

/* ------------------------------------------------------------------ *
 * Dashboard functions
 * ------------------------------------------------------------------ */

export const listTables = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const registered = await ctx.db
      .query("dataTables")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const documents = await ctx.db
      .query("projectData")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_SCAN);
    const counts = new Map<string, number>();
    for (const row of documents) counts.set(row.tableName, (counts.get(row.tableName) ?? 0) + 1);
    for (const row of registered) if (!counts.has(row.name)) counts.set(row.name, 0);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createTable = mutation({
  args: { token: v.string(), projectId: v.id("projects"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const name = validateTableName(args.name);
    const existing = await ctx.db
      .query("dataTables")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    if (existing.some((row) => row.name === name)) fail("That table already exists", 409, "table_exists");
    const now = Date.now();
    await ctx.db.insert("dataTables", { projectId: args.projectId, name, createdAt: now, updatedAt: now });
    return null;
  },
});

export const dropTable = mutation({
  args: { token: v.string(), projectId: v.id("projects"), name: v.string() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const name = validateTableName(args.name);
    const deleted = await deleteDocuments(ctx, args.projectId, { table: name });
    const registered = await ctx.db
      .query("dataTables")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const row of registered) {
      if (row.name === name) await ctx.db.delete(row._id);
    }
    return { deleted };
  },
});

export const browse = query({
  args: {
    token: v.optional(v.string()),
    projectId: v.id("projects"),
    table: v.string(),
    filter: v.optional(v.string()),
    sort: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    try {
      return await findDocuments(ctx, args.projectId, {
        table: args.table,
        filter: args.filter,
        sort: args.sort,
        limit: args.limit,
        offset: args.offset,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), data: [], total: 0, limit: 0, offset: 0 };
    }
  },
});

export const insert = mutation({
  args: { token: v.string(), projectId: v.id("projects"), table: v.string(), document: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    return await insertDocument(ctx, args.projectId, { table: args.table, document: args.document });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    table: v.string(),
    filter: v.string(),
    update: v.string(),
    many: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    return await updateDocuments(ctx, args.projectId, args);
  },
});

export const remove = mutation({
  args: { token: v.string(), projectId: v.id("projects"), table: v.string(), filter: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const deleted = await deleteDocuments(ctx, args.projectId, { table: args.table, filter: args.filter });
    return { success: true, deleted };
  },
});

export const scan = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects"), table: v.string(), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    return await findDocuments(ctx, args.projectId, { table: args.table, limit: args.limit ?? 25 });
  },
});

/* ------------------------------------------------------------------ *
 * Shared write operations
 * ------------------------------------------------------------------ */

export async function insertDocument(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  args: { table: string; document: unknown },
): Promise<{ success: true; id: string }> {
  const table = validateTableName(args.table);
  const document = parseJson(args.document, "Document");
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    fail("Document must be a JSON object", 400, "invalid_document");
  }
  const record = document as Record<string, unknown>;
  const documentId = documentIdOf(record);
  const existing = await ctx.db
    .query("projectData")
    .withIndex("by_project_table_doc", (q) =>
      q.eq("projectId", projectId).eq("tableName", table).eq("documentId", documentId),
    )
    .unique();
  if (existing) {
    fail(`A document with id "${documentId}" already exists in ${table}`, 409, "duplicate_document_id");
  }
  const now = Date.now();
  await ctx.db.insert("projectData", {
    projectId,
    tableName: table,
    documentId,
    document: record,
    createdAt: now,
    updatedAt: now,
  });
  return { success: true, id: documentId };
}

export async function updateDocuments(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  args: { table: string; filter: unknown; update: unknown; many?: boolean },
): Promise<{ success: true; modified: number; documents?: Record<string, unknown>[] }> {
  const table = validateTableName(args.table);
  const filter = parseJson(args.filter, "Filter");
  const update = parseJson(args.update, "Update");
  const rows = await ctx.db
    .query("projectData")
    .withIndex("by_project_table", (q) => q.eq("projectId", projectId).eq("tableName", table))
    .take(MAX_SCAN);
  const targets = rows.filter((row) => matchesFilter(row.document as Record<string, unknown>, filter));
  if (targets.length === 0) return { success: true, modified: 0 };
  const selected = args.many === false ? targets.slice(0, 1) : targets;
  const updated: Record<string, unknown>[] = [];
  for (const row of selected) {
    const next = applyUpdate(row.document as Record<string, unknown>, update);
    const documentId = documentIdOf(next);
    if (documentId !== row.documentId) {
      const clash = await ctx.db
        .query("projectData")
        .withIndex("by_project_table_doc", (q) =>
          q.eq("projectId", projectId).eq("tableName", table).eq("documentId", documentId),
        )
        .unique();
      if (clash) fail(`A document with id "${documentId}" already exists in ${table}`, 409, "duplicate_document_id");
    }
    await ctx.db.patch(row._id, { document: next, documentId, updatedAt: Date.now() });
    updated.push(next);
  }
  return { success: true, modified: selected.length, documents: updated };
}

/* ------------------------------------------------------------------ *
 * HTTP API entry points (principal based)
 * ------------------------------------------------------------------ */

/**
 * Filters, sorts and updates travel as JSON strings because Convex reserves
 * `$`-prefixed keys inside function arguments, and the documented query DSL
 * uses them (`$gt`, `$in`, …). The HTTP layer serialises the caller's JSON.
 */
export const apiFind = internalQuery({
  args: {
    projectId: v.id("projects"),
    principal: principalValidator,
    table: v.string(),
    filterJson: v.optional(v.string()),
    sortJson: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertPermissionFor(ctx, args.projectId, "db_read", args.principal, "db_find");
    return await findDocuments(ctx, args.projectId, {
      table: args.table,
      filter: args.filterJson,
      sort: args.sortJson,
      limit: args.limit,
      offset: args.offset,
    });
  },
});

export const apiInsert = internalMutation({
  args: { projectId: v.id("projects"), principal: principalValidator, table: v.string(), document: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertPermissionFor(ctx, args.projectId, "db_write", args.principal, "db_insert");
    return await insertDocument(ctx, args.projectId, args);
  },
});

export const apiUpdate = internalMutation({
  args: {
    projectId: v.id("projects"),
    principal: principalValidator,
    table: v.string(),
    filter: v.string(),
    update: v.string(),
    many: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertPermissionFor(ctx, args.projectId, "db_write", args.principal, "db_update");
    return await updateDocuments(ctx, args.projectId, args);
  },
});

export const apiDelete = internalMutation({
  args: { projectId: v.id("projects"), principal: principalValidator, table: v.string(), filter: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertPermissionFor(ctx, args.projectId, "db_write", args.principal, "db_delete");
    const deleted = await deleteDocuments(ctx, args.projectId, args);
    return { success: true, deleted };
  },
});

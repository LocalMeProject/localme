import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { assertWithinCap, libraryStorageUsed, storageCaps } from "./lib/files";
import { fail } from "./lib/errors";
import { minifyByExtension } from "./lib/minify";
import {
  INLINE_TEXT_LIMIT,
  contentTypeFor,
  directoryOf,
  fileNameOf,
  isHtmlPath,
  isTextPath,
  normalizeStoragePath,
} from "./lib/paths";
import { assertPermission, principalValidator } from "./lib/principal";
import {
  audit,
  readPlatformUser,
  requireProjectOwnership,
  requireProjectOwnershipMutation,
  requireUserMutation,
} from "./lib/session";
import { emitEvent } from "./lib/webhookBus";

export type FileRecord = {
  id: string;
  path: string;
  name: string;
  directory: string;
  size: number;
  contentType: string;
  isText: boolean;
  updatedAt: number;
};

export function toFileRecord(file: Doc<"files">): FileRecord {
  return {
    id: file._id,
    path: file.path,
    name: file.name,
    directory: file.directory,
    size: file.size,
    contentType: file.contentType,
    isText: file.isText,
    updatedAt: file.updatedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Core helpers
 * ------------------------------------------------------------------ */

export async function upsertFile(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    path: string;
    text?: string;
    storageId?: Id<"_storage">;
    size: number;
    contentType: string;
    isText: boolean;
    minify?: boolean;
  },
): Promise<{ path: string; created: boolean }> {
  const path = normalizeStoragePath(args.path);
  const existing = await ctx.db
    .query("files")
    .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", path))
    .unique();
  const now = Date.now();
  let text = args.text;
  if (text !== undefined && args.minify) text = minifyByExtension(path, text);
  const size = text !== undefined ? text.length : args.size;

  if (existing) {
    if (existing.storageId && existing.storageId !== args.storageId) {
      await ctx.storage.delete(existing.storageId);
    }
    await ctx.db.patch(existing._id, {
      text: text !== undefined ? text : undefined,
      storageId: args.storageId,
      size,
      contentType: args.contentType,
      isText: args.isText,
      name: fileNameOf(path),
      directory: directoryOf(path),
      updatedAt: now,
    });
    return { path, created: false };
  }

  await ctx.db.insert("files", {
    projectId: args.projectId,
    path,
    name: fileNameOf(path),
    directory: directoryOf(path),
    text,
    storageId: args.storageId,
    size,
    contentType: args.contentType,
    isText: args.isText,
    createdAt: now,
    updatedAt: now,
  });
  return { path, created: true };
}

export type ResolvedFile = {
  path: string;
  contentType: string;
  size: number;
  text?: string;
  storageId?: Id<"_storage">;
  isText: boolean;
};

/** Resolution order for serving: exact path, then `<dir>/index.html`. */
export async function resolveProjectFile(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  rawPath: string,
): Promise<ResolvedFile | null> {
  const candidates = [normalizeStoragePath(rawPath)];
  const base = candidates[0];
  if (base === "/") candidates.push("/index.html");
  else if (!base.includes(".")) candidates.push(`${base}/index.html`);

  for (const candidate of candidates) {
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", projectId).eq("path", candidate))
      .unique();
    if (file) {
      return {
        path: file.path,
        contentType: file.contentType,
        size: file.size,
        text: file.text,
        storageId: file.storageId,
        isText: file.isText,
      };
    }
  }
  return null;
}

export async function resolveLibraryFile(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  rawPath: string,
): Promise<ResolvedFile | null> {
  const path = normalizeStoragePath(rawPath);
  const file = await ctx.db
    .query("libraryFiles")
    .withIndex("by_user_path", (q) => q.eq("userId", userId).eq("path", path))
    .unique();
  if (!file) return null;
  return {
    path: file.path,
    contentType: file.contentType,
    size: file.size,
    text: file.text,
    storageId: file.storageId,
    isText: file.isText,
  };
}

export async function resolvePublicLibraryFile(
  ctx: QueryCtx | MutationCtx,
  rawPath: string,
): Promise<ResolvedFile | null> {
  const path = normalizeStoragePath(rawPath);
  const file = await ctx.db
    .query("publicLibraryFiles")
    .withIndex("by_path", (q) => q.eq("path", path))
    .unique();
  if (!file) return null;
  return {
    path: file.path,
    contentType: file.contentType,
    size: file.size,
    text: file.text,
    storageId: file.storageId,
    isText: file.isText,
  };
}

/* ------------------------------------------------------------------ *
 * Dashboard: project storage
 * ------------------------------------------------------------------ */

export const list = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects"), directory: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const all = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const directory = normalizeStoragePath(args.directory ?? "/");
    const entries = all
      .filter((file) => directoryOf(file.path) === directory)
      .map(toFileRecord)
      .sort((a, b) => a.name.localeCompare(b.name));
    const directories = [
      ...new Set(
        all
          .map((file) => directoryOf(file.path))
          .filter((dir) => dir !== directory && dir.startsWith(directory === "/" ? "/" : `${directory}/`))
          .map((dir) => {
            const rest = dir.slice(directory === "/" ? 1 : directory.length + 1);
            const [head] = rest.split("/");
            const child = directory === "/" ? `/${head}` : `${directory}/${head}`;
            return child;
          }),
      ),
    ].sort();
    return { directory, entries, directories, total: all.length };
  },
});

export const status = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const owner = await ctx.db.get((await ctx.db.get(args.projectId))!.userId);
    const caps = owner ? await storageCaps(ctx, owner) : null;
    return {
      used: files.reduce((sum, file) => sum + file.size, 0),
      total: caps?.cap ?? 0,
      accountUsed: caps?.used ?? 0,
      maxUpload: caps?.maxUpload ?? 0,
      files: files.length,
    };
  },
});

export const read = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects"), path: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const file = await resolveProjectFile(ctx, args.projectId, args.path);
    if (!file) return null;
    return {
      path: file.path,
      contentType: file.contentType,
      size: file.size,
      isText: file.isText,
      text: file.text ?? null,
      url: file.storageId ? await ctx.storage.getUrl(file.storageId) : null,
    };
  },
});

export const write = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    minify: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const path = normalizeStoragePath(args.path);
    if (!isTextPath(path)) fail("Only text files can be edited in the browser", 400, "unsupported_file_type");
    if (args.content.length > INLINE_TEXT_LIMIT) {
      fail("File is too large for the built-in editor; upload it instead", 413, "file_too_large");
    }
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", path))
      .unique();
    await assertWithinCap(ctx, user, args.content.length, { replacingBytes: existing?.size ?? 0 });
    const result = await upsertFile(ctx, {
      projectId: args.projectId,
      path,
      text: args.content,
      size: args.content.length,
      contentType: contentTypeFor(path),
      isText: true,
      minify: args.minify,
    });
    await audit(ctx, {
      level: "info",
      event: "storage.write",
      message: `${result.created ? "Created" : "Saved"} ${path}`,
      projectId: args.projectId,
      userId: user._id,
    });
    return { success: true, path: result.path, size: args.content.length };
  },
});

export const uploadUrl = mutation({
  args: { token: v.string(), projectId: v.id("projects") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerUpload = mutation({
  args: {
    token: v.string(),
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
    path: v.string(),
    size: v.number(),
    contentType: v.optional(v.string()),
    minify: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const path = normalizeStoragePath(args.path);
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", path))
      .unique();
    try {
      await assertWithinCap(ctx, user, args.size, { replacingBytes: existing?.size ?? 0 });
    } catch (error) {
      await ctx.storage.delete(args.storageId);
      await emitEvent(ctx, {
        projectId: args.projectId,
        event: "storage.cap_exceeded",
        data: { path, size: args.size },
      });
      throw error;
    }
    return await upsertFile(ctx, {
      projectId: args.projectId,
      path,
      storageId: args.storageId,
      size: args.size,
      contentType: args.contentType?.trim() || contentTypeFor(path),
      isText: false,
      minify: args.minify,
    });
  },
});

export const remove = mutation({
  args: { token: v.string(), projectId: v.id("projects"), path: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const path = normalizeStoragePath(args.path);
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", path))
      .unique();
    if (!file) fail("File not found", 404, "not_found");
    if (file.storageId) await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
    return null;
  },
});

export const move = mutation({
  args: { token: v.string(), projectId: v.id("projects"), from: v.string(), to: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const from = normalizeStoragePath(args.from);
    const to = normalizeStoragePath(args.to);
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", from))
      .unique();
    if (!file) fail("File not found", 404, "not_found");
    const clash = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", to))
      .unique();
    if (clash) fail("A file already exists at that path", 409, "file_exists");
    await ctx.db.patch(file._id, {
      path: to,
      name: fileNameOf(to),
      directory: directoryOf(to),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const moveToLibrary = mutation({
  args: { token: v.string(), projectId: v.id("projects"), path: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const source = normalizeStoragePath(args.path);
    if (isHtmlPath(source)) fail("HTML files cannot live in the library", 400, "unsupported_file_type");
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", source))
      .unique();
    if (!file) fail("File not found", 404, "not_found");
    const destination = normalizeStoragePath(`/${fileNameOf(source)}`);
    const clash = await ctx.db
      .query("libraryFiles")
      .withIndex("by_user_path", (q) => q.eq("userId", user._id).eq("path", destination))
      .unique();
    if (clash) fail("An asset with that name already exists in your library", 409, "file_exists");
    const now = Date.now();
    await ctx.db.insert("libraryFiles", {
      userId: user._id,
      path: destination,
      name: fileNameOf(destination),
      size: file.size,
      contentType: file.contentType,
      text: file.text,
      storageId: file.storageId,
      isText: file.isText,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.delete(file._id);
    return { success: true, path: `/library${destination}` };
  },
});

/* ------------------------------------------------------------------ *
 * Dashboard: library
 * ------------------------------------------------------------------ */

export const libraryList = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user) return { entries: [], used: 0, bonus: 0 };
    const files = await ctx.db
      .query("libraryFiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const caps = await storageCaps(ctx, user);
    return {
      entries: files
        .map((file) => ({
          id: file._id,
          path: `/library${file.path}`,
          name: file.name,
          size: file.size,
          contentType: file.contentType,
          updatedAt: file.updatedAt,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      used: await libraryStorageUsed(ctx, user._id),
      bonus: caps.libraryBonus,
    };
  },
});

export const libraryUploadUrl = mutation({
  args: { token: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireUserMutation(ctx, args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

export const libraryRegisterUpload = mutation({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
    size: v.number(),
    contentType: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    const path = normalizeStoragePath(`/${args.name}`);
    if (isHtmlPath(path)) fail("HTML files cannot live in the library", 400, "unsupported_file_type");
    await assertWithinCap(ctx, user, args.size);
    const now = Date.now();
    await ctx.db.insert("libraryFiles", {
      userId: user._id,
      path,
      name: fileNameOf(path),
      size: args.size,
      contentType: args.contentType?.trim() || contentTypeFor(path),
      storageId: args.storageId,
      isText: false,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, path: `/library${path}` };
  },
});

export const libraryWrite = mutation({
  args: { token: v.string(), name: v.string(), content: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    const path = normalizeStoragePath(`/${args.name}`);
    if (!isTextPath(path)) fail("Only text assets can be written in the browser", 400, "unsupported_file_type");
    if (isHtmlPath(path)) fail("HTML files cannot live in the library", 400, "unsupported_file_type");
    if (args.content.length > INLINE_TEXT_LIMIT) fail("Asset is too large", 413, "file_too_large");
    const existing = await ctx.db
      .query("libraryFiles")
      .withIndex("by_user_path", (q) => q.eq("userId", user._id).eq("path", path))
      .unique();
    await assertWithinCap(ctx, user, args.content.length, { replacingBytes: existing?.size ?? 0 });
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        text: args.content,
        size: args.content.length,
        contentType: contentTypeFor(path),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("libraryFiles", {
        userId: user._id,
        path,
        name: fileNameOf(path),
        size: args.content.length,
        contentType: contentTypeFor(path),
        text: args.content,
        isText: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { success: true, path: `/library${path}` };
  },
});

export const libraryRemove = mutation({
  args: { token: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    const path = normalizeStoragePath(`/${args.name}`);
    const file = await ctx.db
      .query("libraryFiles")
      .withIndex("by_user_path", (q) => q.eq("userId", user._id).eq("path", path))
      .unique();
    if (!file) fail("Asset not found", 404, "not_found");
    if (file.storageId) await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * Admin: public library (`/~public/`)
 * ------------------------------------------------------------------ */

export const publicLibraryList = query({
  args: { token: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await readPlatformUser(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "operator")) return [];
    const files = await ctx.db.query("publicLibraryFiles").collect();
    return files
      .map((file) => ({
        id: file._id,
        path: file.path,
        name: file.name,
        size: file.size,
        contentType: file.contentType,
        updatedAt: file.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const publicLibraryAdd = mutation({
  args: { token: v.string(), name: v.string(), content: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    if (user.role !== "admin") fail("Administrator privileges required", 403, "forbidden");
    const path = normalizeStoragePath(`/${args.name}`);
    if (isHtmlPath(path)) fail("HTML files cannot live in the public library", 400, "unsupported_file_type");
    const existing = await ctx.db
      .query("publicLibraryFiles")
      .withIndex("by_path", (q) => q.eq("path", path))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        text: args.content,
        size: args.content.length,
        contentType: contentTypeFor(path),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("publicLibraryFiles", {
        path,
        name: fileNameOf(path),
        size: args.content.length,
        contentType: contentTypeFor(path),
        text: args.content,
        isText: true,
        uploadedBy: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { success: true, path: `/~public${path}` };
  },
});

export const publicLibraryRemove = mutation({
  args: { token: v.string(), id: v.id("publicLibraryFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUserMutation(ctx, args.token);
    if (user.role !== "admin") fail("Administrator privileges required", 403, "forbidden");
    const file = await ctx.db.get(args.id);
    if (!file) return null;
    if (file.storageId) await ctx.storage.delete(file.storageId);
    await ctx.db.delete(args.id);
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * HTTP API entry points (principal based)
 * ------------------------------------------------------------------ */

/** Unauthenticated file resolution used by the project-serving pipeline. */
export const resolveFile = internalQuery({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    library: v.optional(v.boolean()),
    publicLibrary: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.publicLibrary) return await resolvePublicLibraryFile(ctx, args.path);
    if (args.library) {
      const project = await ctx.db.get(args.projectId);
      if (!project) return null;
      return await resolveLibraryFile(ctx, project.userId, args.path);
    }
    return await resolveProjectFile(ctx, args.projectId, args.path);
  },
});

export const apiStatus = internalQuery({
  args: { projectId: v.id("projects"), principal: principalValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    assertPermission(args.principal, "storage_read");
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    const owner = await ctx.db.get(project.userId);
    const caps = owner ? await storageCaps(ctx, owner) : null;
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return {
      used: files.reduce((sum, file) => sum + file.size, 0),
      total: project.storageAllocatedBytes,
      accountUsed: caps?.used ?? files.reduce((sum, file) => sum + file.size, 0),
      files: files.length,
    };
  },
});

export const apiList = internalQuery({
  args: {
    projectId: v.id("projects"),
    principal: principalValidator,
    path: v.optional(v.string()),
    library: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.library) {
      assertPermission(args.principal, "lib_read");
      const project = await ctx.db.get(args.projectId);
      if (!project) fail("Project not found", 404, "not_found");
      const files = await ctx.db
        .query("libraryFiles")
        .withIndex("by_user", (q) => q.eq("userId", project.userId))
        .collect();
      return files
        .map((file) => ({
          name: file.name,
          path: `/library${file.path}`,
          size: file.size,
          modified: new Date(file.updatedAt).toISOString(),
          type: "file",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    assertPermission(args.principal, "storage_read");
    const directory = normalizeStoragePath(args.path ?? "/");
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return files
      .filter((file) => directoryOf(file.path) === directory)
      .map((file) => ({
        name: file.name,
        path: file.path,
        size: file.size,
        modified: new Date(file.updatedAt).toISOString(),
        type: "file",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const apiResolve = internalQuery({
  args: {
    projectId: v.id("projects"),
    principal: principalValidator,
    path: v.string(),
    library: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    if (args.library) {
      assertPermission(args.principal, "lib_read");
      return await resolveLibraryFile(ctx, project.userId, args.path);
    }
    assertPermission(args.principal, "storage_read");
    return await resolveProjectFile(ctx, args.projectId, args.path);
  },
});

export const apiRecordUpload = internalMutation({
  args: {
    projectId: v.id("projects"),
    principal: principalValidator,
    storageId: v.id("_storage"),
    path: v.string(),
    size: v.number(),
    contentType: v.optional(v.string()),
    library: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    const owner = await ctx.db.get(project.userId);
    if (!owner) fail("Project owner missing", 404, "not_found");
    if (args.library) {
      assertPermission(args.principal, "lib_write");
      const path = normalizeStoragePath(args.path);
      if (isHtmlPath(path)) {
        await ctx.storage.delete(args.storageId);
        fail("HTML files cannot live in the library", 400, "unsupported_file_type");
      }
      await assertWithinCap(ctx, owner, args.size);
      const now = Date.now();
      await ctx.db.insert("libraryFiles", {
        userId: owner._id,
        path,
        name: fileNameOf(path),
        size: args.size,
        contentType: args.contentType?.trim() || contentTypeFor(path),
        storageId: args.storageId,
        isText: false,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, path: `/library${path}`, size: args.size };
    }
    assertPermission(args.principal, "storage_write");
    const path = normalizeStoragePath(args.path);
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", path))
      .unique();
    try {
      await assertWithinCap(ctx, owner, args.size, { replacingBytes: existing?.size ?? 0 });
    } catch (error) {
      await ctx.storage.delete(args.storageId);
      await emitEvent(ctx, {
        projectId: args.projectId,
        event: "storage.cap_exceeded",
        data: { path, size: args.size },
      });
      throw error;
    }
    await upsertFile(ctx, {
      projectId: args.projectId,
      path,
      storageId: args.storageId,
      size: args.size,
      contentType: args.contentType?.trim() || contentTypeFor(path),
      isText: false,
    });
    return { success: true, path, size: args.size };
  },
});

export const apiDelete = internalMutation({
  args: {
    projectId: v.id("projects"),
    principal: principalValidator,
    path: v.string(),
    library: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) fail("Project not found", 404, "not_found");
    const path = normalizeStoragePath(args.path);
    if (args.library) {
      assertPermission(args.principal, "lib_write");
      const file = await ctx.db
        .query("libraryFiles")
        .withIndex("by_user_path", (q) => q.eq("userId", project.userId).eq("path", path))
        .unique();
      if (!file) fail("File not found", 404, "not_found");
      if (file.storageId) await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
      return { success: true };
    }
    assertPermission(args.principal, "storage_write");
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_path", (q) => q.eq("projectId", args.projectId).eq("path", path))
      .unique();
    if (!file) fail("File not found", 404, "not_found");
    if (file.storageId) await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
    return { success: true };
  },
});


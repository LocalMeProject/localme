import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { readConfig } from "./config";
import { fail } from "./errors";
import { isTextPath } from "./paths";

export type FileRow = Doc<"files">;
export type LibraryRow = Doc<"libraryFiles">;
export type PublicLibraryRow = Doc<"publicLibraryFiles">;

/** Total bytes stored across every project plus the user's library. */
export async function userStorageUsed(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<number> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let total = 0;
  for (const project of projects) {
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    total += files.reduce((sum, file) => sum + file.size, 0);
  }
  const library = await ctx.db
    .query("libraryFiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  total += library.reduce((sum, file) => sum + file.size, 0);
  return total;
}

export async function projectStorageUsed(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<number> {
  const files = await ctx.db
    .query("files")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  return files.reduce((sum, file) => sum + file.size, 0);
}

export async function libraryStorageUsed(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<number> {
  const files = await ctx.db
    .query("libraryFiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return files.reduce((sum, file) => sum + file.size, 0);
}

export type StorageCaps = { used: number; cap: number; libraryBonus: number; maxUpload: number };

export async function storageCaps(ctx: QueryCtx | MutationCtx, user: Doc<"users">): Promise<StorageCaps> {
  const config = await readConfig<{
    library_bonus_bytes: number;
    max_upload_size_bytes: number;
  }>(ctx, "storage");
  const used = await userStorageUsed(ctx, user._id);
  const cap = user.storageCapBytes + config.library_bonus_bytes;
  return {
    used,
    cap,
    libraryBonus: config.library_bonus_bytes,
    maxUpload: config.max_upload_size_bytes,
  };
}

/**
 * The storage cap is a hard limit: any write that would exceed it is rejected
 * before data is persisted (P-28), and the caller is told which key to add.
 */
export async function assertWithinCap(
  ctx: MutationCtx,
  user: Doc<"users">,
  additionalBytes: number,
  options: { replacingBytes?: number } = {},
): Promise<void> {
  const { used, cap, maxUpload } = await storageCaps(ctx, user);
  if (additionalBytes > maxUpload) {
    fail(
      `Single files may not exceed ${Math.floor(maxUpload / (1024 * 1024))} MB`,
      413,
      "file_too_large",
    );
  }
  const projected = used - (options.replacingBytes ?? 0) + additionalBytes;
  if (projected > cap) {
    fail("Storage cap exceeded. Delete files or move shared assets to your library.", 402, "storage_cap_exceeded");
  }
}

/** Decodes a stored file to text without touching blob storage. */
export function inlineText(file: { text?: string; isText: boolean; contentType: string; name: string }): string | null {
  if (typeof file.text === "string") return file.text;
  return null;
}

export function defaultContentType(path: string): string {
  return isTextPath(path) ? "text/plain; charset=utf-8" : "application/octet-stream";
}

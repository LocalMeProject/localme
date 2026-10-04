/**
 * Cached Markdown Loader
 *
 * Reads Markdown files from disk with in-memory caching and mtime validation
 * to avoid disk I/O on repeated reads while instantly picking up updates.
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface CacheEntry {
  content: string;
  mtimeMs: number;
  lastRead: number;
}

const memoryCache = new Map<string, CacheEntry>();

export interface CachedMarkdownResult {
  content: string;
  lastModified: string;
  exists: boolean;
}

/**
 * Read a Markdown file with high-performance in-memory caching.
 * @param relativeOrAbsolutePath File path relative to project root or absolute path.
 */
export async function getCachedMarkdown(
  filePath: string,
): Promise<CachedMarkdownResult> {
  const absolutePath = filePath.startsWith("/") || /^[a-zA-Z]:/.test(filePath)
    ? filePath
    : resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return {
      content: "# Not Found\n\nThe requested document was not found.",
      lastModified: new Date().toISOString(),
      exists: false,
    };
  }

  try {
    const stats = statSync(absolutePath);
    const cached = memoryCache.get(absolutePath);

    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return {
        content: cached.content,
        lastModified: new Date(stats.mtimeMs).toISOString(),
        exists: true,
      };
    }

    const content = readFileSync(absolutePath, "utf8");
    memoryCache.set(absolutePath, {
      content,
      mtimeMs: stats.mtimeMs,
      lastRead: Date.now(),
    });

    return {
      content,
      lastModified: new Date(stats.mtimeMs).toISOString(),
      exists: true,
    };
  } catch (error) {
    console.error(`[cached-markdown] Failed to read ${absolutePath}:`, error);
    return {
      content: "# Error\n\nFailed to load document content.",
      lastModified: new Date().toISOString(),
      exists: false,
    };
  }
}

/**
 * Invalidate cached markdown entry if manually needed.
 */
export function invalidateMarkdownCache(filePath?: string): void {
  if (filePath) {
    const absolutePath = filePath.startsWith("/") || /^[a-zA-Z]:/.test(filePath)
      ? filePath
      : resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
    memoryCache.delete(absolutePath);
  } else {
    memoryCache.clear();
  }
}

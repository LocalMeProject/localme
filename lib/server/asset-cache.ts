/**
 * Asset cache (Blueprint §8.1).
 *
 * "File metadata: cached with a 5-minute TTL. Static assets:
 * `Cache-Control: public, max-age=86400`. HTML: `no-store` (visit counting)."
 *
 * The Blueprint caches metadata in `IMemoryCache`; the bytes live in the
 * database (ADR 002), so a metadata-only cache would still re-read the blob on
 * every request. We therefore cache the resolved bytes plus a strong ETag, both
 * bounded and TTL'd, and invalidate on every write. HTML never enters the
 * cache — visit counting and the watermark make it per-request state.
 *
 * The cache is deliberately per-process: a multi-instance deployment still
 * pays a cold miss per instance, but never serves stale content because
 * `invalidateAsset` is called on every write path (upload, delete, import,
 * route-driven writes) and the TTL bounds drift.
 */
import { createHash } from "node:crypto";

export interface CachedAsset {
  content: Buffer;
  etag: string;
  /** File mtime, used for Last-Modified. */
  updatedAt: string;
  sizeBytes: number;
  contentType: string;
}

interface Entry {
  value: CachedAsset;
  expiresAt: number;
}

/** §8.1 says 5 minutes; short enough that a stale deploy cannot linger. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;
/** Bound the cache so a large project cannot exhaust the heap. */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

const entries = new Map<string, Entry>();
let ttlMs = DEFAULT_TTL_MS;
let maxBytes = DEFAULT_MAX_BYTES;
let currentBytes = 0;
/** Number of hits/misses, exposed for tests and the admin stats page. */
let hits = 0;
let misses = 0;

function cacheKey(projectId: number, path: string): string {
  return `${projectId}:${path}`;
}

/** Recompute the ETag for a payload (strong: same bytes → same tag). */
export function etagFor(content: Buffer, sizeBytes = content.byteLength, updatedAt = ""): string {
  return `"${createHash("sha256")
    .update(content)
    .update(`${sizeBytes}:${updatedAt}`)
    .digest("base64url")
    .slice(0, 27)}"`;
}

export function configureAssetCache(options: { ttlMs?: number; maxBytes?: number }): void {
  if (options.ttlMs && options.ttlMs > 0) ttlMs = options.ttlMs;
  if (options.maxBytes && options.maxBytes > 0) maxBytes = options.maxBytes;
  evict();
}

/** Read a cached asset, or null on a miss/expiry. */
export function getCachedAsset(projectId: number, path: string): CachedAsset | null {
  const key = cacheKey(projectId, path);
  const entry = entries.get(key);
  if (!entry) {
    misses += 1;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    currentBytes -= entry.value.content.byteLength;
    misses += 1;
    return null;
  }
  hits += 1;
  // Refresh recency so the LRU eviction below keeps hot assets.
  entries.delete(key);
  entries.set(key, entry);
  return entry.value;
}

/** Store an asset, evicting the least recently used entries over the cap. */
export function setCachedAsset(projectId: number, path: string, value: CachedAsset): void {
  const key = cacheKey(projectId, path);
  const existing = entries.get(key);
  if (existing) currentBytes -= existing.value.content.byteLength;
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  currentBytes += value.content.byteLength;
  evict();
}

function evict(): void {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
      currentBytes -= entry.value.content.byteLength;
    }
  }
  while (currentBytes > maxBytes && entries.size > 0) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    const entry = entries.get(oldest.value);
    entries.delete(oldest.value);
    if (entry) currentBytes -= entry.value.content.byteLength;
  }
}

/** Drop one asset (after a write or delete). */
export function invalidateAsset(projectId: number, path: string): void {
  const key = cacheKey(projectId, path);
  const entry = entries.get(key);
  if (!entry) return;
  entries.delete(key);
  currentBytes -= entry.value.content.byteLength;
}

/** Drop every asset of a project (rename, project settings, import). */
export function invalidateProjectAssets(projectId: number): void {
  const prefix = `${projectId}:`;
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) {
      const entry = entries.get(key);
      entries.delete(key);
      if (entry) currentBytes -= entry.value.content.byteLength;
    }
  }
}

/** Drop everything (used by tests and by a full re-import). */
export function clearAssetCache(): void {
  entries.clear();
  currentBytes = 0;
  hits = 0;
  misses = 0;
}

export function assetCacheStats(): { entries: number; bytes: number; hits: number; misses: number } {
  return { entries: entries.size, bytes: currentBytes, hits, misses };
}

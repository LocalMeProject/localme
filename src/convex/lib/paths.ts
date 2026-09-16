import { fail } from "./errors";

/**
 * Prefixes owned by the platform. User routes may never be defined inside them
 * (Blueprint §5.4 "Reserved Prefixes").
 */
export const RESERVED_PREFIXES = [
  "/api",
  "/auth",
  "/admin",
  "/dashboard",
  "/library",
  "/~public",
  "/health",
  "/_localme",
] as const;

export function isReservedPath(path: string): boolean {
  return RESERVED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

const MAX_SEGMENT = 128;

/**
 * Normalise a user-supplied storage path (P-15 path traversal prevention).
 * Rejects `..`, absolute escapes and control characters; always returns a
 * leading-slash path relative to the project storage root.
 */
export function normalizeStoragePath(input: string | undefined | null): string {
  const raw = (input ?? "/").trim();
  if (raw.includes("\\")) fail("Paths may not contain backslashes", 400, "invalid_path");
  if (raw.includes("\0")) fail("Paths may not contain null bytes", 400, "invalid_path");
  const decoded = raw.replace(/\?.*$/, "");
  const segments = decoded.split("/");
  const safe: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") fail("Path traversal is not allowed", 400, "path_traversal");
    if (segment.length > MAX_SEGMENT) fail("Path segment too long", 400, "invalid_path");
    if (/[\u0000-\u001f\u007f]/.test(segment)) fail("Invalid characters in path", 400, "invalid_path");
    safe.push(segment);
  }
  return `/${safe.join("/")}`.replace(/\/+$/, "") || "/";
}

/** Validates a single file or folder name (no separators, no traversal). */
export function sanitizeName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) fail("Name is required", 400, "invalid_name");
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    fail("Names may not contain path separators", 400, "invalid_name");
  }
  if (trimmed.length > MAX_SEGMENT) fail("Name too long", 400, "invalid_name");
  return trimmed;
}

export function directoryOf(path: string): string {
  const normalized = normalizeStoragePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function fileNameOf(path: string): string {
  const normalized = normalizeStoragePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function extensionOf(path: string): string {
  const name = fileNameOf(path);
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  zip: "application/zip",
  wasm: "application/wasm",
};

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extensionOf(path)] ?? "application/octet-stream";
}

export const TEXT_EXTENSIONS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "json",
  "webmanifest",
  "txt",
  "md",
  "csv",
  "xml",
  "svg",
  "yaml",
  "yml",
  "env",
]);

export function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(path));
}

export function isHtmlPath(path: string): boolean {
  const extension = extensionOf(path);
  return extension === "html" || extension === "htm";
}

/** Inline text storage keeps documents well under the 1 MB document limit. */
export const INLINE_TEXT_LIMIT = 200_000;

export function languageForPath(path: string): string {
  switch (extensionOf(path)) {
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "js":
    case "mjs":
      return "javascript";
    case "json":
    case "webmanifest":
      return "json";
    case "md":
      return "markdown";
    case "svg":
      return "xml";
    default:
      return "plaintext";
  }
}

/** Matches a request path against a route pattern; `*` is a wildcard segment. */
export function matchRoutePattern(pattern: string, path: string): boolean {
  const normalizedPattern = normalizeStoragePath(pattern);
  if (normalizedPattern === path) return true;
  if (!normalizedPattern.includes("*")) return false;
  const escaped = normalizedPattern
    .split("*")
    .map((chunk) => chunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}/?$`).test(path);
}

/** Open-redirect prevention (P-10): only same-origin relative paths pass. */
export function safeReturnUrl(candidate: string | null | undefined, fallback = "/"): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

/**
 * Project serving (Blueprint §5.4/§12-§14, Technical Documentation §3.3.3).
 *
 * Requests to /{username}/{projectname}/... are resolved, in order:
 *   1. `routes` table match — is_proxy routes forward to their configured
 *      upstream; file-target routes serve from storage. Routes with
 *      requires_auth enforce the project's visitor session first.
 *   2. Static file from project storage (DB-backed `files` table, ADR 002).
 *   3. `404.html` from the project root, else the platform 404.
 *
 * Every HTML response gets the platform watermark injected before `</body>`
 * (server-side; per-project toggle, §5.4/§14). Visits are logged to
 * `visit_logs` with a 5-minute dedupe window; unique visits dedupe per
 * (project, route, ip, day) per docs §5.4. A suspended project returns 403
 * and a project over its monthly free-visit quota returns 402.
 */
import { placeholder, type SqlFlavor } from "@/lib/server/db/sql";
import { getDb } from "@/lib/server/db/index";
import { ApiError, statusForCode } from "@/lib/server/http";
import {
  forwardProxyRequest,
  loadSecrets,
  parseProxyConfig,
} from "@/lib/server/proxy-forward";
import { LIBRARY_PROJECT_NAME } from "@/lib/server/repos";
import {
  getVisitorFromRequest,
  signVisitorToken,
  visitorHasRole,
  visitorCookieName,
  visitorCookiePath,
  visitorHasPermission,
  VISITOR_LOGIN_PATH,
  VISITOR_TTL_SECONDS,
} from "@/lib/server/visitor-auth";
import { configNumber, configValue, settingFlag } from "@/lib/server/system-config";
import { checkRateLimitForIdentity, type RouteGroup } from "@/lib/server/ratelimit";
import { isHotlink } from "@/lib/server/hotlink";
import { createLogger } from "@/lib/server/logger";
import { etagFor, getCachedAsset, setCachedAsset } from "@/lib/server/asset-cache";
import { encodedResponseAsync } from "@/lib/server/compress";
import { readDiskFile } from "@/lib/server/storage-disk";
import { injectSocialMeta, generateSocialCardSvg } from "@/lib/server/social-card";

/** Serving logs (§9.4): refusals and upstream faults, never page content. */
const log = createLogger("serving");

/**
 * Watermark markup (Blueprint §14), injected before `</body>` unless the
 * project opts out.
 *
 * §14 pins this to "MVP Platform" linking to `mvp.com` — a leftover from the
 * product's earlier name. Shipping a live link to an unrelated domain on every
 * customer's page is a real problem, so the label and the target are system
 * config (`watermark.label`, `watermark.url`, both empty = the documented
 * default) while the position, styling and "not user-editable" property stay
 * exactly as specified.
 */
/** Minimal HTML escaping for a value interpolated into the watermark. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A string system config, or "" when unset or not a string. */
async function configString(key: string): Promise<string> {
  const value = await configValue<string>(key);
  return typeof value === "string" ? value : "";
}

/** Docs system config: visits.dedupe_window_seconds (default 300 = 5 minutes). */
const DEFAULT_DEDUPE_WINDOW_SECONDS = 300;

/** Serving rate limit groups (§5.11): assets get their own, larger budget. */
const HTML_RATE_GROUP: RouteGroup = "default";
const ASSET_RATE_GROUP: RouteGroup = "assets";

/** 429 response for an over-budget serving request. */
function rateLimitedResponse(retryAfterSeconds: number): Response {
  return new Response("Rate limit exceeded, slow down.", {
    status: 429,
    headers: { "retry-after": String(retryAfterSeconds) },
  });
}

/**
 * The host the *browser* used, which is the host its Referer will carry.
 *
 * `request.url` is rebuilt from the app's own origin, so behind a reverse proxy
 * or a dev tunnel it is the internal host (`localhost`) while the page and its
 * assets are same-origin on the public one. Comparing a Referer against that
 * internal name blocked the project's *own* stylesheet and scripts with 403 —
 * the anti-hotlink rule refusing the site it exists to protect. The forwarded
 * `Host` is the browser's, so it is the one to compare.
 */
function requestHostname(request: Request, fallback: URL): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host")?.trim();
  if (!host) return fallback.hostname;
  // A Host header may carry a port; `hostnameOf` compares hostnames only.
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return fallback.hostname;
  }
}

/**
 * The library-relative path a request refers to, or null.
 *
 * `library` is a reserved top-level folder name (see `LIBRARY_PROJECT_NAME`),
 * so `/library/theme.css` inside any project means "the shared asset", not "a
 * folder this project happens to have". The account's library is served at
 * `/{user}/library/…`; this is how a project references it by a short,
 * domain-relative path that keeps working on a custom domain.
 */
function libraryReference(requestPath: string): string | null {
  const match = /^\/library\/(.+)$/.exec(requestPath);
  if (!match) return null;
  const rest = match[1];
  if (!rest || rest.includes("..")) return null;
  return rest;
}

/** Read one asset out of the account's shared library. */
async function readLibraryAsset(userId: number, path: string): Promise<Buffer | null> {
  const library = await libraryProjectFor(userId);
  if (!library) return null;
  return await readFileBytes(library.projectId, path, { cacheable: true });
}

/** The owner's library project, resolved without creating one on a read path. */
async function libraryProjectFor(userId: number): Promise<ResolvedProject | null> {
  const db = getDb();
  const rows = await db.raw<{ id: number }>(
    `SELECT id FROM projects WHERE user_id = ${placeholder(db.driver, 0)} AND name = ${placeholder(db.driver, 1)}`,
    [userId, LIBRARY_PROJECT_NAME],
  );
  if (!rows[0]) return null;
  return {
    projectId: Number(rows[0].id),
    projectName: LIBRARY_PROJECT_NAME,
    userId,
    isActive: true,
    freeVisitsPerMonth: 0,
    watermarkEnabled: false,
  };
}

/**
 * Serve one shared-library asset with the same caching, compression and
 * anti-hotlink rules a project asset gets. It is not a page: no visit is
 * logged, no watermark is injected and HTML is refused outright, because it is
 * served from the platform origin where a stored page would run scripts against
 * the owner's own console session.
 */
async function serveLibraryAsset(
  request: Request,
  userId: number,
  path: string,
): Promise<Response> {
  if (/\.html?$/i.test(path)) {
    return new Response("Not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const library = await libraryProjectFor(userId);
  if (library) {
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) {
      const cached = getCachedAsset(library.projectId, path);
      if (cached && ifNoneMatch.split(",").some((tag) => tag.trim() === cached.etag)) {
        return new Response(null, {
          status: 304,
          headers: {
            etag: cached.etag,
            "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
            "x-content-type-options": "nosniff",
          },
        });
      }
    }
  }
  const bytes = library ? await readFileBytes(library.projectId, path, { cacheable: true }) : null;
  if (!bytes) return platformNotFound("Asset not found.");

  const requestUrl = new URL(request.url);
  if (
    (await settingFlag("serving.hotlink_protection")) &&
    isHotlink({
      requestHost: requestHostname(request, requestUrl),
      referer: request.headers.get("referer"),
      origin: request.headers.get("origin"),
      userAgent: request.headers.get("user-agent"),
      allowedDomains: library ? await verifiedDomainsFor(library.projectId) : [],
    })
  ) {
    return new Response("Hotlinking to these assets is not allowed.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const headers = new Headers({
    "content-type": contentTypeFor(path),
    "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    "x-content-type-options": "nosniff",
  });
  const etag = library ? getCachedAsset(library.projectId, path)?.etag ?? etagFor(bytes) : null;
  if (etag) {
    headers.set("etag", etag);
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").some((tag) => tag.trim() === etag)) {
      return new Response(null, { status: 304, headers });
    }
  }
  return encodedResponseAsync(request, bytes, Object.fromEntries(headers.entries()));
}

/** Verified custom domains of a project — always allowed as asset referers (§7.8). */
async function verifiedDomainsFor(projectId: number): Promise<string[]> {
  try {
    const db = getDb();
    const rows = await db.raw<{ domain: string }>(
      `SELECT domain FROM domains WHERE project_id = ${placeholder(db.driver, 0)}
       AND is_verified = ${db.driver === "sqlite" ? 1 : "TRUE"}`,
      [projectId],
    );
    return rows.map((row) => String(row.domain));
  } catch {
    return [];
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Platform reserved prefixes never treated as project serving (docs §3.3.3). */
export const RESERVED_PREFIXES = [
  "/api", "/auth", "/admin", "/dashboard", "/account", "/library", "/health",
  "/skills", "/policy", "/~public", "/_next", "/docs", "/favicon.ico", "/fonts",
];

export interface ServingTarget {
  user: string;
  project: string;
  /** Path inside the project, always starting with "/" and never empty. */
  path: string;
}

/** Split /{user}/{project}/rest/into/path — null when not a serving path. */
export function parseServingPath(pathname: string): ServingTarget | null {
  const trimmed = pathname.replace(/\/+$/, "");
  if (!trimmed) return null;
  if (RESERVED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [user, project, ...rest] = segments;
  if (!user || !project) return null;
  return { user, project, path: `/${rest.join("/")}` };
}

export interface ResolvedProject {
  projectId: number;
  projectName: string;
  userId: number;
  isActive: boolean;
  freeVisitsPerMonth: number;
  watermarkEnabled: boolean;
}

/** Look up the project for a serving path by owner username + project name. */
export async function resolveProject(user: string, project: string): Promise<ResolvedProject | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT pr.id AS project_id, pr.name, pr.user_id, pr.is_active, pr.free_visits_per_month, pr.watermark_enabled
     FROM projects pr JOIN users u ON u.id = pr.user_id
     WHERE u.username = ${placeholder(p, 0)} AND pr.name = ${placeholder(p, 1)}
     LIMIT 1`,
    [user, project],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    projectId: Number(row.project_id),
    projectName: String(row.name),
    userId: Number(row.user_id),
    isActive: row.is_active === 1 || row.is_active === true,
    freeVisitsPerMonth: Number(row.free_visits_per_month ?? 100),
    watermarkEnabled: row.watermark_enabled == null || row.watermark_enabled === 1 || row.watermark_enabled === true,
  };
}

export interface RouteRow {
  path_pattern: string;
  target_file: string | null;
  is_proxy: number | boolean;
  proxy_config: string | null;
  requires_auth: number | boolean;
  required_role: string | null;
  required_permission: string | null;
  is_active: number | boolean;
}

/** Find the active route matching the request path (docs §3.3.3).
 *
 * Resolution order: exact pattern → longest proxy mount prefix → catch-all
 * "/". Proxy routes act as mounts, so a route registered at "/gateway"
 * also serves "/gateway/data"; file-target routes match exactly (plus the
 * catch-all), mirroring static hosting semantics.
 */
export async function findRoute(projectId: number, path: string): Promise<RouteRow | null> {
  const db = getDb();
  const p = db.driver;
  const boolLit = p === "sqlite" ? "1" : "TRUE";
  const ph0 = placeholder(p, 0);
  const ph1 = placeholder(p, 1);
  const ph2 = placeholder(p, 2);
  const ph3 = placeholder(p, 3);

  const rows = await db.raw<RouteRow>(
    `SELECT path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, required_permission, is_active FROM routes
     WHERE project_id = ${ph0} AND is_active = ${boolLit}
       AND (
         path_pattern = ${ph1}
         OR (is_proxy = ${boolLit} AND ${ph2} LIKE path_pattern || '%')
         OR (is_proxy = ${boolLit} AND path_pattern = '/')
       )
     ORDER BY CASE WHEN path_pattern = ${ph3} THEN 0 ELSE 1 END,
              LENGTH(path_pattern) DESC
     LIMIT 1`,
    [projectId, path, `${path}/`, path],
  );
  return rows[0] ?? null;
}

/**
 * Read a file's bytes from the DB-backed project storage (ADR 002), through the
 * §8.1 asset cache. HTML is never cached: it is per-request state (visit
 * counting, watermark, visitor session renewal) and is served `no-store`.
 */
async function readFileBytes(
  projectId: number,
  path: string,
  options: { cacheable?: boolean } = {},
): Promise<Buffer | null> {
  if (options.cacheable) {
    const cached = getCachedAsset(projectId, path);
    if (cached) return cached.content;
  }
  // Try disk first (files off SQLite)
  const diskContent = await readDiskFile(projectId, path);
  if (diskContent) {
    if (options.cacheable) {
      setCachedAsset(projectId, path, {
        content: diskContent,
        etag: etagFor(diskContent, diskContent.byteLength),
        updatedAt: new Date().toISOString(),
        sizeBytes: diskContent.byteLength,
        contentType: contentTypeFor(path),
      });
    }
    return diskContent;
  }
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT content_blob, content_text, size_bytes, updated_at FROM files
     WHERE project_id = ${placeholder(db.driver, 0)} AND path = ${placeholder(db.driver, 1)}
     LIMIT 1`,
    [projectId, path],
  );
  const row = rows[0];
  if (!row) return null;
  const content =
    row.content_text != null
      ? Buffer.from(String(row.content_text), "utf8")
      : Buffer.from((row.content_blob as Buffer) ?? Buffer.alloc(0));
  if (options.cacheable) {
    const updatedAt = String(row.updated_at ?? "");
    setCachedAsset(projectId, path, {
      content,
      etag: etagFor(content, Number(row.size_bytes ?? content.byteLength), updatedAt),
      updatedAt,
      sizeBytes: content.byteLength,
      contentType: contentTypeFor(path),
    });
  }
  return content;
}

function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path) || path === "/" || path.endsWith("/");
}

/**
 * Log the visit unless the same (ip, user-agent) hit the same route within
 * the dedupe window. `is_unique` marks the first visit from an (ip, route)
 * pair for the day (docs §5.4 unique-visit definition). Authenticated
 * visitors are attributed via visitor_id.
 */
export async function logVisit(
  projectId: number,
  route: string,
  request: Request,
  visitorId: number | null = null,
): Promise<void> {
  const db = getDb();
  const p: SqlFlavor = db.driver;
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";

  const dedupeWindowSeconds = await configNumber(
    "visits.dedupe_window_seconds",
    DEFAULT_DEDUPE_WINDOW_SECONDS,
  );
  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - dedupeWindowSeconds * 1000).toISOString();
  const recent = await db.raw<{ id: number }>(
    `SELECT id FROM visit_logs
     WHERE project_id = ${placeholder(p, 0)} AND route = ${placeholder(p, 1)}
       AND ip = ${placeholder(p, 2)} AND visited_at > ${placeholder(p, 3)}
     LIMIT 1`,
    [projectId, route, ip, since],
  );
  if (recent[0]) return;

  const dayStart = `${nowIso.slice(0, 10)}T00:00:00.000Z`;
  const sameDay = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visit_logs
     WHERE project_id = ${placeholder(p, 0)} AND route = ${placeholder(p, 1)}
       AND ip = ${placeholder(p, 2)} AND visited_at >= ${placeholder(p, 3)}`,
    [projectId, route, ip, dayStart],
  );
  const isUnique = Number(sameDay[0]?.n ?? 0) === 0;
  const uniqueLit = p === "sqlite" ? (isUnique ? 1 : 0) : isUnique ? "TRUE" : "FALSE";
  const visitorCol = visitorId != null ? `, visitor_id` : "";
  const visitorPh = visitorId != null ? `, ${placeholder(p, 5)}` : "";
  const visitorVal = visitorId != null ? [visitorId] : [];

  // visited_at is inserted explicitly as ISO-8601: the column default's
  // "YYYY-MM-DD HH:MM:SS" format (space, not "T") never compares correctly
  // against ISO bounds in the dedupe/quota queries.
  await db.run(
    `INSERT INTO visit_logs (project_id, route, ip, user_agent, is_unique, visited_at${visitorCol})
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${uniqueLit}, ${placeholder(p, 4)}${visitorPh})`,
    [projectId, route, ip, userAgent, nowIso, ...visitorVal],
  );
}

/** Resolve a verified custom domain to its project (Blueprint §10). */
export async function resolveProjectByDomain(domain: string): Promise<ResolvedProject | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT pr.id AS project_id, pr.name, pr.user_id, pr.is_active, pr.free_visits_per_month, pr.watermark_enabled
     FROM domains d JOIN projects pr ON pr.id = d.project_id
     WHERE d.domain = ${placeholder(p, 0)} AND d.is_verified = ${p === "sqlite" ? 1 : "TRUE"}
     LIMIT 1`,
    [domain.toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    projectId: Number(row.project_id),
    projectName: String(row.name),
    userId: Number(row.user_id),
    isActive: row.is_active === 1 || row.is_active === true,
    freeVisitsPerMonth: Number(row.free_visits_per_month ?? 100),
    watermarkEnabled: row.watermark_enabled == null || row.watermark_enabled === 1 || row.watermark_enabled === true,
  };
}

/** Username of a user id (custom-domain redirects need the path form). */
export async function getUsernameById(userId: number): Promise<string | null> {
  const db = getDb();
  const rows = await db.raw<{ username: string }>(
    `SELECT username FROM users WHERE id = ${placeholder(db.driver, 0)} LIMIT 1`,
    [userId],
  );
  return rows[0]?.username ?? null;
}

/** Visits this month for a project (quota check). */
async function visitsThisMonth(projectId: number): Promise<number> {
  const db = getDb();
  const p = db.driver;
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const rows = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visit_logs
     WHERE project_id = ${placeholder(p, 0)} AND visited_at >= ${placeholder(p, 1)}`,
    [projectId, monthStart],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Monthly visit cap check: dropped per user request (visits are logged for analytics, but not paywalled).
 */
export async function checkVisitQuota(_project: ResolvedProject): Promise<void> {
  // Visit caps dropped; visits continue to be logged for analytics without blocking visitors.
}

/** Inject the watermark just before </body> (docs §14), unless the project opts out. */
export function injectWatermark(html: string, enabled = true, markup = DEFAULT_WATERMARK_HTML): string {
  if (!enabled) return html;
  if (html.includes("</body>")) {
    return html.replace(/<\/body>/i, `${markup}</body>`);
  }
  return `${html}${markup}`;
}

/**
 * Rewrite relative asset references so they resolve against the project root.
 *
 * A project page served at /ada/field-notes/ that says `src="static/app.js"`
 * only works if the browser resolves it under that directory — which it does at
 * the project root but NOT at `/ada/field-notes` (no trailing slash) nor at a
 * routed path such as `/ada/field-notes/reports`, where the browser would look
 * in `/ada/field-notes/reports/static/app.js`. That is exactly the "my script
 * 404s" report this fixes.
 *
 * A single `<base href="/ada/field-notes/">` pins the base URL for the whole
 * document, so every relative reference — src, href, imports(), CSS url() —
 * resolves against the project root from any URL the project is reached at. It
 * is inserted only when the author has not declared one of their own, and never
 * for the custom-domain case, where the project root is simply "/".
 */
export function injectBaseHref(html: string, baseHref: string): string {
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${baseHref}">`;
  const head = /<head[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}${tag}${html.slice(at)}`;
  }
  const htmlTag = /<html[^>]*>/i.exec(html);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return `${html.slice(0, at)}<head>${tag}</head>${html.slice(at)}`;
  }
  return `${tag}${html}`;
}

/** The §14 default, used by the synchronous helper and its tests. */
const DEFAULT_WATERMARK_HTML =
  '<div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(0,0,0,0.7);color:#fff;text-align:center;font-size:12px;padding:4px 0;">Hosted on <a href="https://mvp.com" style="color:#fff;text-decoration:underline;">MVP Platform</a></div>';

/** Config-driven watermark, falling back to the §14 markup. */
async function watermarkMarkup(): Promise<string> {
  const [label, url] = await Promise.all([configString("watermark.label"), configString("watermark.url")]);
  if (!label && !url) return DEFAULT_WATERMARK_HTML;
  const style =
    "position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(0,0,0,0.7);color:#fff;text-align:center;font-size:12px;padding:4px 0;";
  const text = `Hosted on ${escapeHtml(label || "this platform")}`;
  if (!url) return `<div style="${style}">${text}</div>`;
  return `<div style="${style}">Hosted on <a href="${escapeHtml(url)}" style="color:#fff;text-decoration:underline;">${escapeHtml(label || url)}</a></div>`;
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export type ServeResult =
  | { kind: "response"; response: Response }
  | { kind: "not_found"; response: Response };

/**
 * Serve a request for /{user}/{project}/path:
 * proxy route → visitor-auth gate → route target file → static file →
 * 404.html → platform 404, with watermark on all HTML and visit logging on
 * successful page loads.
 */
export async function serveProjectRequest(request: Request, target: ServingTarget): Promise<Response> {
  // Custom-domain requests arrive as target.user === "_domain" and carry the
  // verified hostname in target.project.
  if (target.user === "_domain") {
    const project = await resolveProjectByDomain(target.project);
    if (!project) return platformNotFound("Unknown domain.");
    const owner = await getUsernameById(project.userId);
    if (!owner) return platformNotFound("Unknown domain.");
    // A custom domain serves the project from its own root, so relative asset
    // paths need no rewriting there — see injectBaseHref.
    target = { user: owner, project: project.projectName, path: target.path };
    return serveResolvedProject(request, project, target, { baseHref: "/" });
  }

  // Per-IP serving rate limit keeps hosted projects safe. Requests that look
  // like an asset (path with an extension) draw on the asset budget (§5.11).
  const group = isHtmlPath(target.path) ? HTML_RATE_GROUP : ASSET_RATE_GROUP;
  const limited = await checkRateLimitForIdentity(`serve:${clientIp(request)}`, group);
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const project = await resolveProject(target.user, target.project);
  if (!project) {
    return platformNotFound("Unknown project.");
  }
  // `/{user}/library/<path>` is the library's public URL. It is served as a CDN
  // rather than as a site: no visit quota, no visit logging, no watermark, and
  // no HTML — see serveLibraryAsset.
  if (project.projectName === LIBRARY_PROJECT_NAME) {
    const assetPath = target.path.replace(/^\/+/, "");
    if (!assetPath) return platformNotFound("Asset not found.");
    return await serveLibraryAsset(request, project.userId, assetPath);
  }
  return serveResolvedProject(request, project, target, {
    baseHref: `/${encodeURIComponent(target.user)}/${encodeURIComponent(target.project)}/`,
  });
}

/** Serve a fully-resolved project (shared by path and custom-domain entry). */
async function serveResolvedProject(
  request: Request,
  project: ResolvedProject,
  target: ServingTarget,
  options: { baseHref: string },
): Promise<Response> {
  if (target.path === "/~og-image" || target.path === "~og-image") {
    return new Response(generateSocialCardSvg(target.user, project.projectName), {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  if (!project.isActive) {
    log.warn("suspended_project", { projectId: project.projectId, path: target.path });
    return new Response("Project is suspended.", { status: 403 });
  }

  const requestPath = target.path === "/" ? "/" : target.path.replace(/\/+$/, "") || "/";
  const route = await findRoute(project.projectId, requestPath);

  // Docs §5.5: routes with requires_auth gate every serving path behind the
  // project's visitor session; required_role narrows to that role, and
  // required_permission demands one granular permission from that role.
  const visitorPayload = await getVisitorFromRequest(request, project.projectId);
  const requiredPermission = route?.required_permission ?? null;
  const needsAuth =
    route?.requires_auth === 1 || route?.requires_auth === true || requiredPermission !== null;
  if (needsAuth) {
    if (!visitorPayload) {
      return visitorLoginRedirect(project.projectId, target, requestPath);
    }
    if (!visitorHasRole(visitorPayload, route?.required_role ?? null)) {
      return new Response("Forbidden: insufficient role for this page.", { status: 403 });
    }
    if (requiredPermission && !visitorHasPermission(visitorPayload, requiredPermission)) {
      return new Response(`Forbidden: this page needs the ${requiredPermission} permission.`, {
        status: 403,
      });
    }
  }

  // Proxy routes forward to the configured upstream (docs §13.5).
  if (route && (route.is_proxy === 1 || route.is_proxy === true)) {
    try {
      const config = parseProxyConfig(route.proxy_config);
      const secrets = await loadSecrets(project.projectId);
      return await forwardProxyRequest(request, config, secrets, {
        mountPath: route.path_pattern,
        callerPath: requestPath,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        log.warn("proxy_route_failed", { projectId: project.projectId, path: requestPath, error });
        return new Response(error.message, { status: statusForCode(error.code) });
      }
      throw error;
    }
  }

  const routeTarget = route?.target_file ? String(route.target_file) : null;
  const lookupPaths: string[] = [];

  if (routeTarget) {
    lookupPaths.push(routeTarget);
  }
  lookupPaths.push(requestPath === "/" ? "index.html" : requestPath);
  // Directory-style request: /docs → /docs/index.html
  if (isHtmlPath(requestPath) && requestPath !== "/") {
    lookupPaths.push(`${requestPath.replace(/\/+$/, "")}/index.html`);
  }

  let servedFrom: string | null = null;
  let bytes: Buffer | null = null;
  // Assets are cacheable (§8.1); an HTML target is resolved fresh every time.
  let cacheable = false;
  // `library` is a reserved folder name: a reference to it from inside a
  // project resolves against the account's shared library rather than the
  // project's own files, so one uploaded asset serves every project.
  const libraryRef = libraryReference(requestPath);
  if (libraryRef) {
    const found = await readLibraryAsset(project.userId, libraryRef);
    if (found) {
      bytes = found;
      servedFrom = `/${libraryRef}`;
      cacheable = true;
    }
  }
  const ifNoneMatch = request.headers.get("if-none-match");
  for (const candidate of libraryRef ? [] : lookupPaths) {
    const cleanPath = candidate.replace(/^\//, "");
    const candidateCacheable = !isHtmlPath(cleanPath);
    if (candidateCacheable && ifNoneMatch) {
      const cached = getCachedAsset(project.projectId, cleanPath);
      if (cached && ifNoneMatch.split(",").some((tag) => tag.trim() === cached.etag)) {
        log.debug("asset_fast_path_not_modified", { projectId: project.projectId, path: cleanPath });
        return new Response(null, {
          status: 304,
          headers: {
            etag: cached.etag,
            "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
            "x-content-type-options": "nosniff",
            "x-frame-options": "SAMEORIGIN",
          },
        });
      }
    }
    const found = await readFileBytes(project.projectId, cleanPath, { cacheable: candidateCacheable });
    if (found) {
      bytes = found;
      servedFrom = candidate;
      cacheable = candidateCacheable;
      break;
    }
  }

  if (!bytes) {
    const custom404 = await readFileBytes(project.projectId, "404.html");
    if (custom404) {
      const markup = await watermarkMarkup();
      const body = injectWatermark(
        injectBaseHref(custom404.toString("utf8"), options.baseHref),
        true,
        markup,
      );
      return new Response(body, {
        status: 404,
        headers: { "content-type": CONTENT_TYPES.html },
      });
    }
    return platformNotFound();
  }

  // The shared library is a CDN, not a site: it is referenced by every project
  // the account owns and has no visit quota of its own to exhaust.
  if (servedFrom?.startsWith("/library/")) {
    return await serveLibraryAsset(request, project.userId, servedFrom.slice("/library/".length));
  }

  await checkVisitQuota(project);

  const contentType = contentTypeFor(servedFrom!);
  const isHtml = contentType.startsWith("text/html");

  // Docs count VISITS as HTML page serves — assets ride along for free.
  if (isHtml) {
    await logVisit(project.projectId, servedFrom!, request, visitorPayload?.sub ?? null);
  }

  const headers = new Headers({ "content-type": contentType });
  if (isHtml) {
    // no-store for HTML; long-lived caching for assets is set below.
    headers.set("cache-control", "no-store");
    // Slide-renew the visitor session (docs §6.2) on authenticated page loads.
    if (visitorPayload) {
      const renewed = await signVisitorToken({
        sub: visitorPayload.sub,
        project_id: visitorPayload.project_id,
        role: visitorPayload.role,
        permissions: visitorPayload.permissions,
      });
      headers.append(
        "set-cookie",
        `${visitorCookieName(project.projectId)}=${renewed}; Path=${visitorCookiePath(target.user, target.project)}; HttpOnly; SameSite=Lax; Max-Age=${VISITOR_TTL_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
    }
    // HTML is the largest text payload a project serves, so it goes through the
    // same negotiation as every other text response: an `Accept-Encoding: br`
    // client gets a compressed page. `no-store` is preserved, and the extra
    // `set-cookie` is merged in after compression.
    const compressed = await encodedResponseAsync(
      request,
      Buffer.from(
        injectSocialMeta(
          injectWatermark(
            injectBaseHref(bytes.toString("utf8"), options.baseHref),
            project.watermarkEnabled,
            await watermarkMarkup(),
          ),
          target.user,
          project.projectName,
        ),
        "utf8",
      ),
      { "content-type": contentType, "cache-control": "no-store" },
    );
    if (headers.get("set-cookie")) {
      compressed.headers.append("set-cookie", headers.get("set-cookie")!);
    }
    return compressed;
  }
  // Assets: hotlink validation (§7.8), then long-lived caching + compression.
  const requestUrl = new URL(request.url);
  if (
    (await settingFlag("serving.hotlink_protection")) &&
    isHotlink({
      requestHost: requestHostname(request, requestUrl),
      referer: request.headers.get("referer"),
      origin: request.headers.get("origin"),
      userAgent: request.headers.get("user-agent"),
      allowedDomains: await verifiedDomainsFor(project.projectId),
    })
  ) {
    log.warn("hotlink_blocked", {
      projectId: project.projectId,
      path: requestPath,
      referer_host: request.headers.get("referer"),
    });
    return new Response("Hotlinking to this project's assets is not allowed.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");

  // Conditional request (§8.1): a matching ETag answers 304 with no body.
  const cleanPath = servedFrom!.replace(/^\//, "");
  const etag = cacheable ? getCachedAsset(project.projectId, cleanPath)?.etag ?? etagFor(bytes) : null;
  if (etag) {
    headers.set("etag", etag);
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").some((tag) => tag.trim() === etag)) {
      log.debug("asset_not_modified", { projectId: project.projectId, path: cleanPath });
      return new Response(null, { status: 304, headers });
    }
  }
  return encodedResponseAsync(request, bytes, Object.fromEntries(headers.entries()));
}

/** Redirect unauthenticated visitors to the built-in login page (docs §5.5). */
function visitorLoginRedirect(projectId: number, target: ServingTarget, requestPath: string): Response {
  const projectBase = `/${target.user}/${target.project}`;
  const returnUrl = encodeURIComponent(`${projectBase}${requestPath === "/" ? "/" : requestPath}`);
  return new Response(null, {
    status: 303,
    headers: {
      location: `${VISITOR_LOGIN_PATH}?projectId=${projectId}&returnUrl=${returnUrl}`,
    },
  });
}

/** The platform's own 404. `message` is escaped: it must never carry markup. */
function platformNotFound(message = "Page not found."): Response {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return new Response(
    `<!doctype html><html><head><title>404 — Not Found</title></head><body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;"><h1>404</h1><p>${safe}</p></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

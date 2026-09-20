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
 * (enforced server-side; not user-editable). Visits are logged to
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
import {
  getVisitorFromRequest,
  visitorHasRole,
  VISITOR_LOGIN_PATH,
} from "@/lib/server/visitor-auth";

/** Docs §14: fixed, non-removable watermark injected before </body>. */
const WATERMARK_HTML =
  '<div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(0,0,0,0.7);color:#fff;text-align:center;font-size:12px;padding:4px 0;">Hosted on <a href="https://mvp.com" style="color:#fff;text-decoration:underline;">MVP Platform</a></div>';

/** Docs system config: visits.dedupe_window_seconds (300 = 5 minutes). */
const DEDUPE_WINDOW_SECONDS = 300;

/** Platform reserved prefixes never treated as project serving (docs §3.3.3). */
export const RESERVED_PREFIXES = ["/api", "/auth", "/admin", "/dashboard", "/library", "/~public", "/_next", "/docs"];

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
}

/** Look up the project for a serving path by owner username + project name. */
export async function resolveProject(user: string, project: string): Promise<ResolvedProject | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT pr.id AS project_id, pr.name, pr.user_id, pr.is_active, pr.free_visits_per_month
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
  };
}

export interface RouteRow {
  target_file: string | null;
  is_proxy: number | boolean;
  proxy_config: string | null;
  requires_auth: number | boolean;
  required_role: string | null;
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

  const rows = await db.raw<RouteRow>(
    `SELECT target_file, is_proxy, proxy_config, requires_auth, required_role, is_active FROM routes
     WHERE project_id = ${ph0} AND is_active = ${boolLit}
       AND (
         path_pattern = ${ph1}
         OR (is_proxy = ${boolLit} AND ${ph2} LIKE path_pattern || '%')
         OR (is_proxy = ${boolLit} AND path_pattern = '/')
       )
     ORDER BY CASE WHEN path_pattern = ${ph1} THEN 0 ELSE 1 END,
              LENGTH(path_pattern) DESC
     LIMIT 1`,
    [projectId, path, `${path}/`],
  );
  return rows[0] ?? null;
}

/** Read a file's bytes from the DB-backed project storage (ADR 002). */
async function readFileBytes(projectId: number, path: string): Promise<Buffer | null> {
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT content_blob, content_text FROM files
     WHERE project_id = ${placeholder(db.driver, 0)} AND path = ${placeholder(db.driver, 1)}
     LIMIT 1`,
    [projectId, path],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.content_text != null) return Buffer.from(String(row.content_text), "utf8");
  return Buffer.from(row.content_blob as Buffer);
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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";

  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000).toISOString();
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

/** Projects over their free-visit quota are paywalled (402). */
export async function checkVisitQuota(project: ResolvedProject): Promise<void> {
  const visits = await visitsThisMonth(project.projectId);
  if (visits >= project.freeVisitsPerMonth) {
    throw new ApiError("payment_required", "Project has exceeded its free visit quota.");
  }
}

/** Inject the watermark into an HTML body just before </body> (docs §14). */
export function injectWatermark(html: string): string {
  if (html.includes("</body>")) {
    return html.replace(/<\/body>/i, `${WATERMARK_HTML}</body>`);
  }
  return `${html}${WATERMARK_HTML}`;
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
  const project = await resolveProject(target.user, target.project);
  if (!project) {
    return platformNotFound("Unknown project.");
  }
  if (!project.isActive) {
    return new Response("Project is suspended.", { status: 403 });
  }

  const requestPath = target.path === "/" ? "/" : target.path.replace(/\/+$/, "") || "/";
  const route = await findRoute(project.projectId, requestPath);

  // Docs §5.5: routes with requires_auth gate every serving path behind the
  // project's visitor session; required_role narrows to that role.
  const visitorPayload = await getVisitorFromRequest(request, project.projectId);
  if (route?.requires_auth === 1 || route?.requires_auth === true) {
    if (!visitorPayload) {
      return visitorLoginRedirect(target, requestPath);
    }
    if (!visitorHasRole(visitorPayload, route.required_role)) {
      return new Response("Forbidden: insufficient role for this page.", { status: 403 });
    }
  }

  // Proxy routes forward to the configured upstream (docs §13.5).
  if (route && (route.is_proxy === 1 || route.is_proxy === true)) {
    try {
      const config = parseProxyConfig(route.proxy_config);
      const secrets = await loadSecrets(project.projectId);
      return await forwardProxyRequest(request, config, secrets);
    } catch (error) {
      if (error instanceof ApiError) {
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
  for (const candidate of lookupPaths) {
    const found = await readFileBytes(project.projectId, candidate.replace(/^\//, ""));
    if (found) {
      bytes = found;
      servedFrom = candidate;
      break;
    }
  }

  if (!bytes) {
    const custom404 = await readFileBytes(project.projectId, "404.html");
    if (custom404) {
      return new Response(injectWatermark(custom404.toString("utf8")), {
        status: 404,
        headers: { "content-type": CONTENT_TYPES.html },
      });
    }
    return platformNotFound();
  }

  await checkVisitQuota(project);
  await logVisit(project.projectId, servedFrom!, request, visitorPayload?.sub ?? null);

  const contentType = contentTypeFor(servedFrom!);
  if (contentType.startsWith("text/html")) {
    return new Response(injectWatermark(bytes.toString("utf8")), {
      status: 200,
      headers: { "content-type": contentType },
    });
  }
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

/** Redirect unauthenticated visitors to the built-in login page (docs §5.5). */
function visitorLoginRedirect(target: ServingTarget, requestPath: string): Response {
  const projectBase = `/${target.user}/${target.project}`;
  const returnUrl = encodeURIComponent(`${projectBase}${requestPath === "/" ? "/" : requestPath}`);
  return new Response(null, {
    status: 303,
    headers: { location: `${VISITOR_LOGIN_PATH}?returnUrl=${returnUrl}` },
  });
}

function platformNotFound(message = "Page not found."): Response {
  return new Response(
    `<!doctype html><html><head><title>404 — Not Found</title></head><body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;"><h1>404</h1><p>${message}</p></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

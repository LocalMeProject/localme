import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { errorCode, errorMessage, errorStatus } from "./lib/errors";
import {
  CAPTCHA_COOKIE,
  SESSION_COOKIE,
  VISITOR_COOKIE_PREFIX,
  parseCookies,
  serializeCookie,
} from "./lib/session";
import { ANONYMOUS, type Principal } from "./lib/principal";
import { roleSatisfies } from "./lib/permissions";
import { contentTypeFor, isHtmlPath, normalizeStoragePath, safeReturnUrl } from "./lib/paths";

/**
 * LocalMe HTTP surface.
 *
 * Everything a deployed project can call is defined here, exactly as the
 * published API reference describes it: `/api/db/*`, `/api/storage/*`,
 * `/api/lib/*`, `/api/secrets/*`, `/auth/*`, `/library/*`, `/~public/*`, proxy
 * routes and the project-serving pipeline `/{username}/{project}/...`.
 */
const http = httpRouter();

const FALLBACK_LIMITS = {
  public_requests_per_minute: 60,
  authenticated_requests_per_minute: 300,
  admin_requests_per_minute: 600,
  api_key_requests_per_minute: 600,
  asset_requests_per_minute: 1000,
  library_requests_per_minute: 1000,
  ip_fallback_requests_per_minute: 30,
};

type RuntimeConfig = {
  platform: {
    name: string;
    support_email: string;
    console_url: string;
    watermark_text: string;
    watermark_url: string;
    allow_public_signup: boolean;
  };
  rateLimits: Record<string, number>;
  visits: { free_visits_per_month: number; dedupe_window_seconds: number };
  auth: { max_login_attempts: number; lockout_minutes: number; session_timeout_minutes: number };
  storage: { max_upload_size_bytes: number };
};

type ProjectInfo = {
  id: Id<"projects">;
  name: string;
  ownerUsername: string;
  isActive: boolean;
  watermarkEnabled: boolean;
  visitorAuthEnabled: boolean;
  signupEnabled: boolean;
  defaultVisitorRole: string;
  visitsUsedThisMonth: number;
  freeVisitsPerMonth: number;
};

type RequestContext = {
  url: URL;
  path: string;
  cookies: Record<string, string>;
  ip: string;
  userAgent?: string;
  config: RuntimeConfig;
  projectId?: Id<"projects">;
  project?: ProjectInfo;
  principal: Principal;
  visitorToken?: string;
  sessionToken?: string;
};

/* ------------------------------------------------------------------ *
 * Response helpers
 * ------------------------------------------------------------------ */

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-api-key, x-project-id, authorization",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    vary: "origin",
  };
}

function jsonResponse(request: Request, payload: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-localme": "platform",
      ...corsHeaders(request),
      ...extra,
    },
  });
}

function textResponse(request: Request, body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(request),
      ...extra,
    },
  });
}

function htmlResponse(
  request: Request,
  body: string,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache, no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      ...corsHeaders(request),
      ...extra,
    },
  });
}

async function guard(request: Request, handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return jsonResponse(
      request,
      { error: errorMessage(error), code: errorCode(error) },
      errorStatus(error),
    );
  }
}

/* ------------------------------------------------------------------ *
 * Request context
 * ------------------------------------------------------------------ */

function slugFromPath(path: string): { username: string; name: string; rest: string } | null {
  const match = /^\/([A-Za-z0-9_]{3,32})\/([A-Za-z0-9-]{3,32})(\/.*)?$/.exec(path);
  if (!match) return null;
  return { username: match[1], name: match[2], rest: match[3] && match[3] !== "" ? match[3] : "/" };
}

async function resolveProjectId(
  ctx: ActionCtx,
  request: Request,
  url: URL,
  cookies: Record<string, string>,
): Promise<{ projectId?: Id<"projects">; slug?: { username: string; name: string; rest: string } }> {
  // 1. The canonical hosting form: /{username}/{project}/...
  const pathSlug = slugFromPath(url.pathname);
  if (pathSlug) {
    const found = await ctx.runQuery(internal.authz.projectBySlug, {
      username: pathSlug.username,
      name: pathSlug.name,
    });
    if (found) return { projectId: found.projectId as Id<"projects">, slug: pathSlug };
  }

  // Only well-formed Convex ids are accepted, otherwise a typo would surface as
  // an internal error instead of "project context missing".
  const idShaped = (value: string | null): value is string => Boolean(value && /^[a-z0-9]{20,40}$/i.test(value));
  const headerId = request.headers.get("x-project-id");
  if (idShaped(headerId)) return { projectId: headerId as Id<"projects"> };
  const queryId = url.searchParams.get("projectId") ?? url.searchParams.get("project");
  if (idShaped(queryId)) return { projectId: queryId as Id<"projects"> };

  const slugParam = slugFromPath(`/${url.searchParams.get("username") ?? ""}/${url.searchParams.get("name") ?? ""}`);
  if (slugParam && url.searchParams.get("username") && url.searchParams.get("name")) {
    const found = await ctx.runQuery(internal.authz.projectBySlug, {
      username: slugParam.username,
      name: slugParam.name,
    });
    if (found) return { projectId: found.projectId as Id<"projects">, slug: slugParam };
  }

  for (const candidate of [request.headers.get("referer"), request.headers.get("origin")]) {
    if (!candidate) continue;
    try {
      const slug = slugFromPath(new URL(candidate).pathname);
      if (!slug) continue;
      const found = await ctx.runQuery(internal.authz.projectBySlug, { username: slug.username, name: slug.name });
      if (found) return { projectId: found.projectId as Id<"projects">, slug };
    } catch {
      /* ignore malformed referer values */
    }
  }

  for (const key of Object.keys(cookies)) {
    if (key.startsWith(VISITOR_COOKIE_PREFIX)) {
      const candidate = key.slice(VISITOR_COOKIE_PREFIX.length);
      if (candidate.length > 0) return { projectId: candidate as Id<"projects"> };
    }
  }

  return {};
}

async function loadContext(ctx: ActionCtx, request: Request, touch = true): Promise<RequestContext> {
  const url = new URL(request.url);
  const path = normalizeStoragePath(decodeURIComponent(url.pathname));
  const cookies = parseCookies(request.headers.get("cookie"));
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? (forwarded.split(",")[0] ?? "").trim() || "0.0.0.0" : "0.0.0.0";
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const config = (await ctx.runQuery(internal.settings.runtimeConfig, {})) as RuntimeConfig;
  const resolved = await resolveProjectId(ctx, request, url, cookies);

  const context: RequestContext = {
    url,
    path,
    cookies,
    ip,
    userAgent,
    config,
    projectId: resolved.projectId,
    principal: { ...ANONYMOUS, ip },
    sessionToken: cookies[SESSION_COOKIE],
  };

  // Hosted projects are served from `/{username}/{project}/<path>`; the path the
  // project itself sees is the remainder after that prefix.
  if (resolved.slug) context.path = normalizeStoragePath(resolved.slug.rest);

  if (resolved.projectId) {
    const result = await ctx.runMutation(internal.authz.resolvePrincipal, {
      projectId: resolved.projectId,
      apiKey: request.headers.get("x-api-key") ?? undefined,
      sessionToken: cookies[SESSION_COOKIE],
      visitorToken: cookies[`${VISITOR_COOKIE_PREFIX}${resolved.projectId}`],
      ip,
      userAgent,
      touch,
    });
    if (result?.projectExists === false) {
      context.projectId = undefined;
      return context;
    }
    context.principal = (result?.principal ?? context.principal) as Principal;
    if (result?.project) context.project = result.project as ProjectInfo;
    context.visitorToken = cookies[`${VISITOR_COOKIE_PREFIX}${resolved.projectId}`];
  }

  return context;
}

/* ------------------------------------------------------------------ *
 * Rate limiting
 * ------------------------------------------------------------------ */

function limitFor(config: RuntimeConfig, principal: Principal, path: string): number {
  const limits = { ...FALLBACK_LIMITS, ...(config.rateLimits ?? {}) };
  // Asset and library traffic is rate limited by route group first, so a page
  // loading fifty images does not consume the page-view budget.
  if (path.startsWith("/library") || path.startsWith("/~public")) return limits.library_requests_per_minute;
  if (principal.kind === "owner" || principal.kind === "admin") return limits.admin_requests_per_minute;
  if (principal.kind === "api_key") return limits.api_key_requests_per_minute;
  if (!isHtmlPath(path)) return limits.asset_requests_per_minute;
  if (principal.kind === "anonymous") return limits.ip_fallback_requests_per_minute;
  if (principal.kind === "visitor") return limits.authenticated_requests_per_minute;
  return limits.public_requests_per_minute;
}

function identityFor(context: RequestContext): string {
  const { principal } = context;
  if (principal.kind === "visitor" && principal.visitorId) return `visitor:${principal.visitorId}`;
  if (principal.kind === "owner" || principal.kind === "admin") return `user:${principal.userId ?? "unknown"}`;
  if (principal.kind === "api_key") return `key:${principal.username ?? "unknown"}`;
  return `ip:${context.ip}`;
}

/** Owner and admin principals bypass per-route role requirements. */
function isPlatformPrincipal(principal: Principal): boolean {
  return principal.kind === "owner" || principal.kind === "admin";
}

async function enforceRateLimit(
  ctx: ActionCtx,
  request: Request,
  context: RequestContext,
  pattern: string,
): Promise<Response | null> {
  const limit = limitFor(context.config, context.principal, context.path);
  const result = await ctx.runMutation(internal.maintenance.consumeRateLimit, {
    identity: identityFor(context),
    routePattern: pattern,
    limit,
  });
  if (result?.allowed === false) {
    return jsonResponse(
      request,
      {
        error: "Too many requests",
        code: "rate_limited",
        limit: result.limit,
        retry_after_seconds: result.retryAfterSeconds,
      },
      429,
      { "retry-after": String(result.retryAfterSeconds ?? 60) },
    );
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Platform pages
 * ------------------------------------------------------------------ */

function pageShell(title: string, platformName: string, body: string, status: number): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${status} — ${title}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0B1220; color:#F4F2ED; padding:40px 20px;
    font:16px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; text-align:center; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:56px; color:#FF6B2C; letter-spacing:-0.03em; }
  h1 { font-size:20px; margin:6px 0 10px; }
  p { color:#A8B0BE; max-width:46ch; margin:0 auto 18px; }
  a { color:#FF6B2C; }
  .brand { font-family: ui-monospace, monospace; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#6F7A8A; margin-top:26px; }
</style>
</head>
<body>
  <div>
    <div class="code">${status}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="/">Back to the homepage</a>
    <div class="brand">${platformName}</div>
  </div>
</body>
</html>`;
}

function platformPage(
  request: Request,
  context: RequestContext,
  status: number,
  title: string,
  message: string,
): Response {
  const body = pageShell(title, context.config.platform.name, message, status);
  return htmlResponse(request, body, status);
}

function watermarkMarkup(config: RuntimeConfig): string {
  const text = config.platform.watermark_text || "Hosted on LocalMe";
  const url = config.platform.watermark_url || "https://localme.com";
  return `<div id="localme-watermark" style="position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:rgba(11,18,32,.82);color:#F4F2ED;text-align:center;font:12px/1.7 ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:3px 8px;backdrop-filter:blur(6px)">${text} · <a href="${url}" style="color:#FF6B2C;text-decoration:none" rel="noopener" target="_blank">${new URL(url).hostname}</a></div>`;
}

function injectWatermark(document: string, markup: string): string {
  const close = document.toLowerCase().lastIndexOf("</body>");
  if (close === -1) return `${document}\n${markup}`;
  return `${document.slice(0, close)}${markup}\n${document.slice(close)}`;
}

/* ------------------------------------------------------------------ *
 * File responses
 * ------------------------------------------------------------------ */

type ResolvedFile = {
  path: string;
  contentType: string;
  size: number;
  text?: string | null;
  storageId?: string | null;
  isText: boolean;
};

async function fileResponse(
  ctx: ActionCtx,
  _request: Request,
  file: ResolvedFile,
  options: { download?: boolean; cacheSeconds?: number } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": file.contentType || contentTypeFor(file.path),
    "x-content-type-options": "nosniff",
  };
  if (options.download) {
    headers["content-disposition"] = `attachment; filename="${file.path.split("/").pop() ?? "download"}"`;
  }
  if (options.cacheSeconds && options.cacheSeconds > 0) {
    headers["cache-control"] = `public, max-age=${options.cacheSeconds}`;
  } else {
    headers["cache-control"] = "no-cache, no-store, private";
  }
  if (typeof file.text === "string") {
    return new Response(file.text, { status: 200, headers });
  }
  if (file.storageId) {
    const blob = await ctx.storage.get(file.storageId as Id<"_storage">);
    if (blob) {
      return new Response(blob, { status: 200, headers });
    }
  }
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
}

/** Anti-hotlinking for `/static/*` and `/library/*` (P-14). */
function refererAllowed(request: Request): boolean {
  const referer = request.headers.get("referer");
  if (!referer) return true;
  try {
    const refererUrl = new URL(referer);
    const requestUrl = new URL(request.url);
    return refererUrl.host === requestUrl.host || refererUrl.host === request.headers.get("host");
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * /health
 * ------------------------------------------------------------------ */

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const health = await ctx.runQuery(internal.settings.runtimeConfig, {});
    const projects = await ctx.runQuery(internal.insights.platformTotals, {});
    return jsonResponse(request, {
      status: "healthy",
      service: "localme",
      version: "1.0.0",
      platform: (health as RuntimeConfig).platform.name,
      projects: projects.projects,
      accounts: projects.users,
      checks: { database: "ok", cron: "ok", storage: "ok" },
      time: new Date().toISOString(),
    });
  }),
});

/* ------------------------------------------------------------------ *
 * /auth/*
 * ------------------------------------------------------------------ */

http.route({
  path: "/auth/captcha",
  method: "GET",
  handler: httpAction(async (ctx, _request) => {
    const challenge = await ctx.runMutation(internal.authz.issueCaptcha, {});
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="56" viewBox="0 0 180 56" role="img" aria-label="CAPTCHA">
  <rect width="180" height="56" rx="8" fill="#0F172A"/>
  <line x1="6" y1="40" x2="174" y2="18" stroke="#26303F" stroke-width="2"/>
  <line x1="10" y1="12" x2="170" y2="44" stroke="#26303F" stroke-width="2"/>
  <text x="90" y="37" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="26" fill="#FF6B2C" letter-spacing="3">${challenge.question} = ?</text>
</svg>`;
    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "no-store",
        "set-cookie": serializeCookie(CAPTCHA_COOKIE, challenge.captchaId, { maxAge: 300, httpOnly: false }),
      },
    });
  }),
});

http.route({
  path: "/auth/me",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const context = await loadContext(ctx, request);
      if (!context.projectId) {
        return jsonResponse(request, { authenticated: false, visitor: null, owner: null });
      }
      const visitor = await ctx.runQuery(internal.authz.visitorMe, {
        projectId: context.projectId,
        visitorToken: context.visitorToken,
      });
      return jsonResponse(request, {
        authenticated: Boolean(visitor) || context.principal.kind === "owner" || context.principal.kind === "admin",
        projectId: context.projectId,
        visitor,
        role: context.principal.roleName ?? null,
        permissions: context.principal.permissions,
        kind: context.principal.kind,
        platformUser: context.principal.kind === "owner" || context.principal.kind === "admin"
          ? context.principal.username ?? null
          : null,
      });
    }),
  ),
});

http.route({
  path: "/auth/login",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const context = await loadContext(ctx, request);
      const returnUrl = safeReturnUrl(context.url.searchParams.get("returnUrl"), context.project
        ? `/${context.project.ownerUsername}/${context.project.name}/`
        : "/");
      if (!context.projectId || !context.project) {
        return platformPage(
          request,
          context,
          404,
          "Project not found",
          "This login page belongs to a project that does not exist (or the link is missing project context).",
        );
      }
      if (!context.project.visitorAuthEnabled) {
        return platformPage(
          request,
          context,
          403,
          "Login disabled",
          `Visitor authentication is turned off for <strong>${context.project.name}</strong>.`,
        );
      }
      const customLogin = await ctx.runQuery(internal.storage.resolveFile, {
        projectId: context.projectId,
        path: "/login.html",
      });
      if (customLogin) {
        return await fileResponse(ctx, request, customLogin as ResolvedFile, { cacheSeconds: 0 });
      }
      const challenge = await ctx.runMutation(internal.authz.issueCaptcha, {});
      const html = loginPage({
        platformName: context.config.platform.name,
        projectName: context.project.name,
        projectId: String(context.projectId),
        captchaId: challenge.captchaId,
        question: challenge.question,
        returnUrl,
        allowSignup: context.project.signupEnabled,
      });
      return htmlResponse(request, html, 200, {
        "set-cookie": serializeCookie(CAPTCHA_COOKIE, challenge.captchaId, { maxAge: 300, httpOnly: false }),
      });
    }),
  ),
});

function loginPage(args: {
  platformName: string;
  projectName: string;
  projectId: string;
  captchaId: string;
  question: string;
  returnUrl: string;
  allowSignup: boolean;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — ${args.projectName}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0B1220; color:#F4F2ED; padding:32px 18px;
    font:15px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  form { width:100%; max-width:380px; border:1px solid #26303F; border-radius:14px; background:#0F172A; padding:28px; }
  .tag { font-family: ui-monospace, monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#FF6B2C; }
  h1 { font-size:22px; margin:12px 0 20px; }
  label { display:block; font-size:12px; color:#8892A2; margin:14px 0 6px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:9px; border:1px solid #33405A; background:#0B1220; color:#F4F2ED; font-size:14px; }
  input:focus { outline:none; border-color:#FF6B2C; }
  .captcha { display:flex; gap:10px; align-items:center; margin-top:6px; }
  .captcha .q { font-family: ui-monospace, monospace; background:#131C2C; border:1px solid #26303F; border-radius:8px; padding:8px 12px; color:#9AD5FF; white-space:nowrap; }
  button { width:100%; margin-top:20px; padding:11px 16px; border:0; border-radius:9px; background:#FF6B2C; color:#0B1220; font-weight:700; font-size:14px; cursor:pointer; }
  button:hover { filter:brightness(1.06); }
  .alt { margin-top:16px; font-size:13px; color:#8892A2; text-align:center; }
  .alt button { background:transparent; color:#FF6B2C; border:1px solid #33405A; margin-top:8px; }
  .error { margin-top:14px; padding:10px 12px; border-radius:8px; background:rgba(220,38,38,.12); border:1px solid rgba(220,38,38,.4); color:#FCA5A5; font-size:13px; display:none; }
  footer { margin-top:18px; text-align:center; font-family: ui-monospace, monospace; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#5A6472; }
</style>
</head>
<body>
<form id="localme-login">
  <div class="tag">${args.platformName} project auth</div>
  <h1>${args.projectName}</h1>
  <label for="username">Username</label>
  <input id="username" name="username" autocomplete="username" required>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <div id="captcha-row">
    <label for="captcha">CAPTCHA</label>
    <div class="captcha">
      <span class="q">${args.question} = ?</span>
      <input id="captcha" name="captcha" inputmode="numeric" autocomplete="off" required>
    </div>
  </div>
  <div class="error" id="error"></div>
  <button type="submit" data-mode="login">Sign in</button>
  ${args.allowSignup ? '<div class="alt">New here?<br><button type="button" data-mode="signup">Create an account</button></div>' : ""}
  <footer>${args.platformName} · secured by visitor auth</footer>
</form>
<script>
  var form = document.getElementById('localme-login');
  var errorBox = document.getElementById('error');
  var mode = 'login';
  document.querySelectorAll('[data-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = button.getAttribute('data-mode');
      if (next === mode) return;
      mode = next;
      var signingUp = mode === 'signup';
      document.querySelector('button[type="submit"]').textContent = signingUp ? 'Create account' : 'Sign in';
      var row = document.getElementById('captcha-row');
      row.style.display = signingUp ? 'none' : 'block';
      document.getElementById('captcha').required = !signingUp;
    });
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.style.display = 'none';
    fetch('/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: mode,
        projectId: '${args.projectId}',
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        captcha: document.getElementById('captcha').value,
        captchaId: '${args.captchaId}',
        returnUrl: ${JSON.stringify(args.returnUrl)}
      })
    })
      .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          window.location.href = result.data.redirectUrl || ${JSON.stringify(args.returnUrl)};
          return;
        }
        errorBox.textContent = result.data.error || 'Sign in failed';
        errorBox.style.display = 'block';
      })
      .catch(function () {
        errorBox.textContent = 'Network error. Try again.';
        errorBox.style.display = 'block';
      });
  });
</script>
</body>
</html>`;
}

http.route({
  path: "/auth/token",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const context = await loadContext(ctx, request, false);
      const limited = await enforceRateLimit(ctx, request, context, "/auth/token");
      if (limited) return limited;
      const raw = await request.text();
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        return jsonResponse(request, { error: "Body must be valid JSON", code: "invalid_json" }, 400);
      }
      const formLike = new URLSearchParams(raw);
      const value = (key: string) => (body[key] ?? formLike.get(key) ?? undefined) as string | undefined;
      const projectId = (value("projectId") ?? context.projectId) as Id<"projects"> | undefined;
      if (!projectId) {
        return jsonResponse(
          request,
          { error: "Missing project context. Pass projectId or call this from your project's URL.", code: "missing_project" },
          400,
        );
      }
      const action = value("action") === "signup" ? "signup" : "login";
      const captchaId = value("captchaId") ?? context.cookies[CAPTCHA_COOKIE];
      const captchaAnswer = value("captcha") ?? value("captchaAnswer");
      const returnUrl = safeReturnUrl(value("returnUrl"), "/");

      if (action === "signup") {
        const result = await ctx.runMutation(internal.authz.visitorSignup, {
          projectId,
          username: value("username") ?? "",
          password: value("password") ?? "",
          captchaId,
          captchaAnswer,
          ip: context.ip,
          userAgent: context.userAgent,
        });
        return jsonResponse(
          request,
          {
            success: true,
            redirectUrl: returnUrl,
            projectId: String(projectId),
            visitorId: result.visitorId,
            token: result.token,
          },
          200,
          { "set-cookie": visitorCookie(String(projectId), result.token) },
        );
      }

      const result = await ctx.runMutation(internal.authz.visitorLogin, {
        projectId,
        username: value("username") ?? "",
        password: value("password") ?? "",
        captchaId,
        captchaAnswer,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      return jsonResponse(
        request,
        {
          success: true,
          redirectUrl: returnUrl,
          projectId: String(projectId),
          visitorId: result.visitorId,
          role: result.roleName,
          token: result.token,
        },
        200,
        { "set-cookie": visitorCookie(String(projectId), result.token) },
      );
    }),
  ),
});

function visitorCookie(projectId: string, token: string): string {
  return serializeCookie(`${VISITOR_COOKIE_PREFIX}${projectId}`, token, {
    maxAge: 20 * 60,
    httpOnly: false,
    sameSite: "Lax",
  });
}

http.route({
  path: "/auth/logout",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const context = await loadContext(ctx, request, false);
      const returnUrl = safeReturnUrl(context.url.searchParams.get("returnUrl"), "/");
      const projectId = (context.url.searchParams.get("projectId") ?? context.projectId) as
        | Id<"projects">
        | undefined;
      if (projectId) {
        await ctx.runMutation(internal.authz.visitorLogout, {
          projectId,
          visitorToken: context.cookies[`${VISITOR_COOKIE_PREFIX}${projectId}`],
        });
      }
      const headers: Record<string, string> = { location: returnUrl };
      if (projectId) {
        headers["set-cookie"] = serializeCookie(`${VISITOR_COOKIE_PREFIX}${projectId}`, "", { maxAge: 0, httpOnly: false });
      }
      return new Response(null, { status: 302, headers });
    }),
  ),
});

/* ------------------------------------------------------------------ *
 * /api/db/*
 * ------------------------------------------------------------------ */

async function apiContext(ctx: ActionCtx, request: Request, endpointName: string, pattern: string) {
  const context = await loadContext(ctx, request);
  if (!context.projectId) {
    return { error: jsonResponse(request, { error: "Missing project context", code: "missing_project" }, 400) };
  }
  const endpoints = await ctx.runQuery(internal.routing.endpointConfig, {
    projectId: context.projectId,
    endpointName,
  });
  if (endpoints && endpoints.isEnabled === false) {
    return {
      error: jsonResponse(request, { error: "This endpoint is disabled for the project", code: "endpoint_disabled" }, 403),
    };
  }
  if (endpoints && endpoints.requiresAuth !== false && context.principal.kind === "anonymous") {
    return { error: jsonResponse(request, { error: "Authentication required", code: "unauthenticated" }, 401) };
  }
  // The per-endpoint role requirement from the Routing tab is enforced here so
  // every /api/* endpoint honours it, not just the ones checked in the services.
  if (endpoints?.requiredRole && !isPlatformPrincipal(context.principal) && (!roleSatisfies(context.principal.roleName, endpoints.requiredRole))) {
    return {
      error: jsonResponse(
        request,
        {
          error: `This endpoint requires the ${endpoints.requiredRole} role`,
          code: "forbidden",
          required_role: endpoints.requiredRole,
          role: context.principal.roleName ?? "Guest",
        },
        403,
      ),
    };
  }
  const principal: Principal = endpoints && endpoints.requiresAuth === false
    ? {
        ...context.principal,
        permissions: [
          "db_read",
          "db_write",
          "storage_read",
          "storage_write",
          "lib_read",
          "lib_write",
          "secrets_admin",
        ],
      }
    : context.principal;
  const limited = await enforceRateLimit(ctx, request, context, pattern);
  if (limited) return { error: limited };
  return { context, principal: principal as Principal };
}

async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("Body must be valid JSON"), { statusCode: 400, code: "invalid_json" });
  }
}

http.route({
  path: "/api/db/find",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "db_find", "/api/db/find");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const result = await ctx.runQuery(internal.data.apiFind, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        table: String(body.table ?? ""),
        filterJson: body.filter === undefined ? undefined : JSON.stringify(body.filter),
        sortJson: body.sort === undefined ? undefined : JSON.stringify(body.sort),
        limit: body.limit === undefined ? undefined : Number(body.limit),
        offset: body.offset === undefined ? undefined : Number(body.offset),
      });
      return jsonResponse(request, result);
    }),
  ),
});

http.route({
  path: "/api/db/insert",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "db_insert", "/api/db/insert");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const result = await ctx.runMutation(internal.data.apiInsert, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        table: String(body.table ?? ""),
        document: JSON.stringify(body.document ?? null),
      });
      return jsonResponse(request, result, 201);
    }),
  ),
});

http.route({
  path: "/api/db/update",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "db_update", "/api/db/update");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const result = await ctx.runMutation(internal.data.apiUpdate, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        table: String(body.table ?? ""),
        filter: JSON.stringify(body.filter ?? {}),
        update: JSON.stringify(body.update ?? {}),
        many: body.many === undefined ? undefined : Boolean(body.many),
      });
      return jsonResponse(request, result);
    }),
  ),
});

http.route({
  path: "/api/db/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "db_delete", "/api/db/delete");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const result = await ctx.runMutation(internal.data.apiDelete, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        table: String(body.table ?? ""),
        filter: JSON.stringify(body.filter ?? {}),
      });
      return jsonResponse(request, result);
    }),
  ),
});

/* ------------------------------------------------------------------ *
 * /api/storage/* and /api/lib/*
 * ------------------------------------------------------------------ */

const MAX_CLIENT_UPLOAD = 10 * 1024 * 1024;

async function handleUpload(ctx: ActionCtx, request: Request, library: boolean): Promise<Response> {
  const endpoint = library ? "lib_upload" : "storage_upload";
  const resolved = await apiContext(ctx, request, endpoint, library ? "/api/lib/upload" : "/api/storage/upload");
  if (resolved.error) return resolved.error;
  const context = resolved.context!;
  const contentTypeHeader = request.headers.get("content-type") ?? "";
  let path = context.url.searchParams.get("path") ?? "/";
  let bytes: Uint8Array | null = null;
  let filename = "";
  let contentType = "";

  if (contentTypeHeader.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonResponse(request, { error: "Multipart uploads need a `file` field", code: "missing_file" }, 400);
    }
    filename = file.name;
    contentType = file.type;
    bytes = new Uint8Array(await file.arrayBuffer());
    const formPath = form.get("path");
    if (typeof formPath === "string" && formPath) path = formPath;
  } else {
    const buffer = new Uint8Array(await request.arrayBuffer());
    if (buffer.length === 0) {
      return jsonResponse(request, { error: "Empty request body", code: "empty_body" }, 400);
    }
    bytes = buffer;
    filename = context.url.searchParams.get("filename") ?? "upload.bin";
    contentType = contentTypeHeader.split(";")[0] || "application/octet-stream";
  }

  if (bytes.length > MAX_CLIENT_UPLOAD) {
    return jsonResponse(request, { error: "Files may not exceed 10 MB", code: "file_too_large" }, 413);
  }
  const target = path.endsWith("/") || path === "" ? `${path}${filename}` : path;
  if (filename && !path.endsWith(filename)) {
    // `path` was a directory: append the filename unless it already names a file.
  }
  const storageId = await ctx.storage.store(new Blob([bytes.slice().buffer], { type: contentType || undefined }));
  const result = await ctx.runMutation(internal.storage.apiRecordUpload, {
    projectId: context.projectId as Id<"projects">,
    principal: resolved.principal!,
    storageId,
    path: target,
    size: bytes.length,
    contentType: contentType || undefined,
    library,
  });
  return jsonResponse(request, { ...result, success: true }, 201);
}

http.route({
  path: "/api/storage/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => guard(request, () => handleUpload(ctx, request, false))),
});

http.route({
  path: "/api/lib/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => guard(request, () => handleUpload(ctx, request, true))),
});

http.route({
  path: "/api/storage/list",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "storage_list", "/api/storage/list");
      if (resolved.error) return resolved.error;
      const result = await ctx.runQuery(internal.storage.apiList, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        path: resolved.context!.url.searchParams.get("path") ?? "/",
      });
      return jsonResponse(request, result);
    }),
  ),
});

http.route({
  path: "/api/lib/list",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "lib_list", "/api/lib/list");
      if (resolved.error) return resolved.error;
      const result = await ctx.runQuery(internal.storage.apiList, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        library: true,
      });
      return jsonResponse(request, result);
    }),
  ),
});

http.route({
  path: "/api/storage/status",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "storage_status", "/api/storage/status");
      if (resolved.error) return resolved.error;
      return jsonResponse(
        request,
        await ctx.runQuery(internal.storage.apiStatus, {
          projectId: resolved.context!.projectId as Id<"projects">,
          principal: resolved.principal!,
        }),
      );
    }),
  ),
});

http.route({
  path: "/api/lib/status",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "lib_status", "/api/lib/status");
      if (resolved.error) return resolved.error;
      const status = await ctx.runQuery(internal.storage.apiStatus, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
      });
      return jsonResponse(request, { ...status, scope: "library" });
    }),
  ),
});

http.route({
  path: "/api/storage/download",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "storage_download", "/api/storage/download");
      if (resolved.error) return resolved.error;
      const path = resolved.context!.url.searchParams.get("path") ?? "/";
      const file = await ctx.runQuery(internal.storage.apiResolve, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        path,
      });
      if (!file) return jsonResponse(request, { error: "File not found", code: "not_found" }, 404);
      return await fileResponse(ctx, request, file as ResolvedFile, { cacheSeconds: 0 });
    }),
  ),
});

http.route({
  path: "/api/storage/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "storage_delete", "/api/storage/delete");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const result = await ctx.runMutation(internal.storage.apiDelete, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        path: String(body.path ?? "/"),
      });
      return jsonResponse(request, result);
    }),
  ),
});

http.route({
  path: "/api/lib/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "lib_delete", "/api/lib/delete");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const result = await ctx.runMutation(internal.storage.apiDelete, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        path: String(body.path ?? body.name ?? "/"),
        library: true,
      });
      return jsonResponse(request, result);
    }),
  ),
});

/* ------------------------------------------------------------------ *
 * /api/secrets/get
 * ------------------------------------------------------------------ */

http.route({
  path: "/api/secrets/get",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      const resolved = await apiContext(ctx, request, "secrets_get", "/api/secrets/get");
      if (resolved.error) return resolved.error;
      const body = await bodyJson(request);
      const secret = await ctx.runQuery(internal.secrets.apiGetSecret, {
        projectId: resolved.context!.projectId as Id<"projects">,
        principal: resolved.principal!,
        key: String(body.key ?? ""),
      });
      return jsonResponse(request, secret);
    }),
  ),
});

/* ------------------------------------------------------------------ *
 * /library/{path} and /~public/{path}
 * ------------------------------------------------------------------ */

http.route({
  pathPrefix: "/library/",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      if (!refererAllowed(request)) {
        return jsonResponse(request, { error: "Hotlinking is not permitted", code: "forbidden_referer" }, 403);
      }
      const context = await loadContext(ctx, request, false);
      const limited = await enforceRateLimit(ctx, request, context, "/library/*");
      if (limited) return limited;
      if (!context.projectId) {
        return textResponse(request, "Missing project context for /library/*", 400);
      }
      const relative = context.url.pathname.replace(/^\/library\/?/, "");
      const file = await ctx.runQuery(internal.storage.resolveFile, {
        projectId: context.projectId,
        path: `/${relative}`,
        library: true,
      });
      if (!file) return textResponse(request, "Asset not found", 404);
      return await fileResponse(ctx, request, file as ResolvedFile, { cacheSeconds: 86_400 });
    }),
  ),
});

http.route({
  pathPrefix: "/~public/",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    guard(request, async () => {
      if (!refererAllowed(request)) {
        return jsonResponse(request, { error: "Hotlinking is not permitted", code: "forbidden_referer" }, 403);
      }
      const context = await loadContext(ctx, request, false);
      const limited = await enforceRateLimit(ctx, request, context, "/~public/*");
      if (limited) return limited;
      const relative = context.url.pathname.replace(/^\/~public\/?/, "");
      const file = await ctx.runQuery(internal.storage.resolveFile, {
        projectId: context.projectId ?? ("public" as Id<"projects">),
        path: `/${relative}`,
        publicLibrary: true,
      });
      if (!file) return textResponse(request, "Asset not found", 404);
      return await fileResponse(ctx, request, file as ResolvedFile, { cacheSeconds: 86_400 });
    }),
  ),
});

/* ------------------------------------------------------------------ *
 * Project serving pipeline: /{username}/{project}/{route}
 * ------------------------------------------------------------------ */

async function serveProject(ctx: ActionCtx, request: Request): Promise<Response> {
  const context = await loadContext(ctx, request);
  if (context.path.startsWith("/api/")) {
    return jsonResponse(request, { error: "Unknown API endpoint", code: "not_found" }, 404);
  }
  if (!context.projectId || !context.project) {
    return platformPage(
      request,
      context,
      404,
      "Project not found",
      "No LocalMe project matches this URL. Check the owner and project name.",
    );
  }
  const project = context.project;
  if (!project.isActive) {
    return platformPage(
      request,
      context,
      503,
      "Project suspended",
      `The project <strong>${project.name}</strong> is currently disabled by its owner.`,
    );
  }

  if (!isHtmlPath(context.path)) {
    if (!refererAllowed(request)) {
      return jsonResponse(request, { error: "Hotlinking is not permitted", code: "forbidden_referer" }, 403);
    }
  }

  const route = await ctx.runQuery(internal.routing.matchRoute, {
    projectId: context.projectId,
    path: context.path,
  });

  if (route?.isProxy) {
    return await forwardProxy(ctx, request, context, route);
  }

  const limited = await enforceRateLimit(ctx, request, context, route ? "route" : "asset");
  if (limited) return limited;

  const targetPath = route?.targetFile ?? context.path;
  const resolvedTarget = route ? targetPath : await resolveStaticPath(ctx, context.projectId, context.path);

  if (route) {
    if (route.requiresAuth && context.principal.kind === "anonymous") {
      const loginUrl = `/auth/login?returnUrl=${encodeURIComponent(context.url.pathname)}&projectId=${context.projectId}`;
      return new Response(null, { status: 302, headers: { location: loginUrl } });
    }
    if (
      route.requiredRole &&
      !isPlatformPrincipal(context.principal) &&
      !roleSatisfies(context.principal.roleName, route.requiredRole)
    ) {
      return platformPage(
        request,
        context,
        403,
        "Forbidden",
        `This route requires the <strong>${route.requiredRole}</strong> role.`,
      );
    }
  }

  const file = resolvedTarget
    ? await ctx.runQuery(internal.storage.resolveFile, { projectId: context.projectId, path: resolvedTarget })
    : null;

  if (!file) {
    return await serveNotFound(ctx, request, context);
  }

  const resolved = file as ResolvedFile;

  if (isHtmlPath(resolved.path)) {
    const visit = await ctx.runMutation(api.insights.recordVisit, {
      projectId: context.projectId,
      route: context.path,
      ip: context.ip,
      userAgent: context.userAgent,
      visitorId: context.principal.kind === "visitor" ? context.principal.visitorId : undefined,
      sessionId: context.principal.sessionId,
    });
    if (visit?.overLimit) {
      return platformPage(
        request,
        context,
        402,
        "Visit allowance reached",
        `This project used all ${visit.freeVisits} free visits for the month. The allowance resets on the 1st.`,
      );
    }
    const body = typeof resolved.text === "string" ? resolved.text : await readBlobText(ctx, resolved);
    if (body !== null && project.watermarkEnabled && !context.url.searchParams.has("nowatermark")) {
      return htmlResponse(request, injectWatermark(body, watermarkMarkup(context.config)));
    }
    if (typeof resolved.text === "string") {
      return htmlResponse(request, resolved.text);
    }
    return await fileResponse(ctx, request, resolved, { cacheSeconds: 0 });
  }

  return await fileResponse(ctx, request, resolved, {
    cacheSeconds: resolved.path.startsWith("/static/") ? 86_400 : 3_600,
    download: context.url.searchParams.get("download") === "1",
  });
}

async function readBlobText(ctx: ActionCtx, file: ResolvedFile): Promise<string | null> {
  if (!file.storageId) return null;
  const blob = await ctx.storage.get(file.storageId as Id<"_storage">);
  if (!blob) return null;
  return await blob.text();
}

/** Static resolution with the documented fallback order. */
async function resolveStaticPath(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  path: string,
): Promise<string | null> {
  const candidates = [path === "/" ? "/index.html" : path];
  if (!path.includes(".")) candidates.push(`${path}/index.html`);
  for (const candidate of candidates) {
    const file = await ctx.runQuery(internal.storage.resolveFile, { projectId, path: candidate });
    if (file) return (file as ResolvedFile).path;
  }
  return null;
}

async function serveNotFound(ctx: ActionCtx, request: Request, context: RequestContext): Promise<Response> {
  if (!context.projectId) {
    return platformPage(request, context, 404, "Not found", "This page does not exist.");
  }
  const custom = await ctx.runQuery(internal.storage.resolveFile, { projectId: context.projectId, path: "/404.html" });
  if (custom) {
    const body = typeof (custom as ResolvedFile).text === "string"
      ? ((custom as ResolvedFile).text as string)
      : await readBlobText(ctx, custom as ResolvedFile);
    if (body !== null) {
      const withWatermark = context.project?.watermarkEnabled
        ? injectWatermark(body, watermarkMarkup(context.config))
        : body;
      return htmlResponse(request, withWatermark, 404);
    }
  }
  return platformPage(
    request,
    context,
    404,
    "Page not found",
    `No file or route in <strong>${context.project?.name ?? "this project"}</strong> matches <code>${context.path}</code>.`,
  );
}

/* ------------------------------------------------------------------ *
 * Proxy routes
 * ------------------------------------------------------------------ */

async function forwardProxy(
  ctx: ActionCtx,
  request: Request,
  context: RequestContext,
  route: { requiresAuth?: boolean; requiredRole?: string | null; proxyConfig?: unknown },
): Promise<Response> {
  if (route.requiresAuth && context.principal.kind === "anonymous") {
    return jsonResponse(request, { error: "Authentication required", code: "unauthenticated" }, 401);
  }
  if (
    route.requiredRole &&
    !isPlatformPrincipal(context.principal) &&
    !roleSatisfies(context.principal.roleName, route.requiredRole)
  ) {
    return jsonResponse(
      request,
      { error: `This route requires the ${route.requiredRole} role`, code: "forbidden" },
      403,
    );
  }
  const config = (route.proxyConfig ?? {}) as {
    target?: string;
    method?: string;
    headers?: Record<string, string>;
    timeout_seconds?: number;
  };
  if (!config.target) {
    return jsonResponse(request, { error: "Proxy route has no target", code: "invalid_proxy" }, 500);
  }
  const secrets = context.projectId
    ? ((await ctx.runQuery(internal.secrets.proxySecrets, { projectId: context.projectId })) as Record<string, string>)
    : {};
  const substitute = (value: string) =>
    value.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, key: string) => secrets[key] ?? "");

  const targetUrl = substitute(config.target);
  const headers = new Headers();
  for (const [key, value] of Object.entries(config.headers ?? {})) {
    if (key.toLowerCase() === "host" || key.toLowerCase() === "content-length") continue;
    headers.set(key, substitute(String(value)));
  }
  const incomingType = request.headers.get("content-type");
  if (incomingType && !headers.has("content-type")) headers.set("content-type", incomingType);
  if (incomingType?.includes("application/json")) headers.set("content-type", "application/json");

  const method = (config.method ?? request.method ?? "POST").toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const timeoutMs = Math.min(Math.max(Number(config.timeout_seconds ?? 30), 1), 60) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: "follow",
    });
    const responseHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      if (["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key.toLowerCase())) continue;
      responseHeaders.set(key, value);
    }
    responseHeaders.set("x-localme-proxy", "1");
    const payload = await response.arrayBuffer();
    return new Response(payload, { status: response.status, headers: responseHeaders });
  } catch (error) {
    return jsonResponse(
      request,
      {
        error: "Upstream request failed",
        code: "proxy_error",
        detail: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Registration of the catch-all handlers
 * ------------------------------------------------------------------ */

for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
  http.route({
    pathPrefix: "/",
    method,
    handler: httpAction(async (ctx, request) => guard(request, () => serveProject(ctx, request))),
  });
}

http.route({
  pathPrefix: "/api/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request) })),
});

http.route({
  pathPrefix: "/auth/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request) })),
});

export default http;

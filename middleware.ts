/**
 * Serving middleware (docs §3.3.3): anything that isn't a platform-reserved
 * prefix is a candidate for /{user}/{project}/... project serving. Middleware
 * runs on the edge runtime, so it must not import the DB layer — it rewrites
 * to the internal Node-runtime serving route which does the DB work.
 *
 * Custom domains (Blueprint §10): when the Host matches a verified domain,
 * the whole request path is served from that domain's project — the rewrite
 * carries the domain in the /~serving path and the serving route resolves it
 * to a project via the verified `domains` table.
 */
import { NextResponse, type NextRequest } from "next/server";

/**
 * Platform reserved prefixes never treated as project serving (docs §3.3.3).
 *
 * Exported so `tests/server/serving.test.ts` can assert the `matcher` regex
 * stays in step with it — the two are separate mechanisms and a prefix added
 * to one but not the other is silently swallowed.
 */
export const RESERVED_PREFIXES = [
  "/api", "/auth", "/admin", "/dashboard", "/account", "/library", "/health",
  "/~public", "/~serving", "/_next", "/docs", "/favicon.ico",
  // The platform's own web fonts (public/fonts/*.woff2). Without this,
  // /fonts/iransans-regular.woff2 parses as user="fonts",
  // project="iransans-regular.woff2" and gets rewritten to the serving
  // route, which 404s — every Persian page would silently fall back to a
  // system font.
  "/fonts",
];

/**
 * "" for "/" or "/", otherwise the path with its trailing slashes removed.
 *
 * The serving routes are exact-match (project root, plus a required
 * catch-all), so every rewrite target must arrive without a trailing slash —
 * otherwise Next answers with its own normalization redirect instead of
 * matching a route.
 */
function stripTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, "");
}

function parseServingPath(pathname: string): { user: string; project: string; path: string } | null {
  const trimmed = stripTrailingSlash(pathname);
  if (!trimmed) return null;
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [user, project, ...rest] = segments;
  if (!user || !project) return null;
  return { user, project, path: `/${rest.join("/")}` };
}

/** True when the Host is the platform's own host (not a custom domain). */
function isPlatformHost(hostname: string): boolean {
  if (hostname.startsWith("localhost") || hostname.startsWith("127.") || hostname === "0.0.0.0") {
    return true;
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      if (new URL(configured).hostname === hostname) return true;
    } catch {
      // Ignore malformed site URL.
    }
  }
  // Freebuff-style preview hosts: anything with a port suffix on unknown domains
  // cannot be verified as a custom domain at the middleware layer anyway.
  return false;
}

export const config = {
  // `~serving` is this file's own rewrite target: excluding it keeps the
  // internal route from being re-entered (and reached directly) by a request
  // for /~serving/... on the platform host.
  //
  // Everything in `RESERVED_PREFIXES` must also appear in this lookahead. The
  // matcher is a regex and the prefix list is a prefix test; keeping them in
  // step by hand is how `/fonts/*.woff2` ends up rewritten to the serving
  // route and 404s. `tests/server/middleware-prefixes.test.ts` asserts they
  // agree.
  matcher: [
    "/((?!api|auth|admin|dashboard|account|library|health|~public|~serving|_next|docs|favicon.ico|fonts).*)",
  ],
};

/** The compiled matcher, for tests that need to ask "does this path run middleware?". */
export const MATCHER_PATTERN =
  /^\/((?!api|auth|admin|dashboard|account|library|health|~public|~serving|_next|docs|favicon.ico|fonts).*)$/;

/**
 * ACME HTTP-01 validation (Blueprint §5.6 step 5) must reach the platform on
 * the domain being certified, which is by definition not a verified custom
 * domain yet. This path is therefore answered before any hosting rewrite.
 */
const ACME_CHALLENGE_PREFIX = "/.well-known/acme-challenge/";

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;

  if (request.nextUrl.pathname.startsWith(ACME_CHALLENGE_PREFIX)) {
    return NextResponse.next();
  }

  // Custom domain: any non-platform Host serves entirely from that project.
  if (!isPlatformHost(hostname)) {
    return NextResponse.rewrite(
      new URL(`/~serving/_domain/${hostname}${stripTrailingSlash(request.nextUrl.pathname)}`, request.url),
    );
  }

  const servingTarget = parseServingPath(request.nextUrl.pathname);
  if (!servingTarget) return NextResponse.next();
  if (RESERVED_PREFIXES.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // Rewrite to the Node-runtime serving route which touches the database.
  return NextResponse.rewrite(
    new URL(
      `/~serving/${servingTarget.user}/${servingTarget.project}${stripTrailingSlash(servingTarget.path)}`,
      request.url,
    ),
  );
}

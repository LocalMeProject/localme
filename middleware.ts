/**
 * Serving middleware (docs §3.3.3): anything that isn't a platform-reserved
 * prefix is a candidate for /{user}/{project}/... project serving. Middleware
 * runs on the edge runtime, so it must not import the DB layer — it rewrites
 * to the internal Node-runtime serving route which does the DB work.
 */
import { NextResponse, type NextRequest } from "next/server";

/** Platform reserved prefixes never treated as project serving (docs §3.3.3). */
const RESERVED_PREFIXES = ["/api", "/auth", "/admin", "/dashboard", "/library", "/~public", "/_next", "/docs", "/favicon.ico"];

function parseServingPath(pathname: string): { user: string; project: string; path: string } | null {
  const trimmed = pathname.replace(/\/+$/, "");
  if (!trimmed) return null;
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [user, project, ...rest] = segments;
  if (!user || !project) return null;
  return { user, project, path: `/${rest.join("/")}` };
}

export const config = {
  matcher: ["/((?!api|auth|admin|dashboard|library|~public|_next|docs).*)"],
};

export function middleware(request: NextRequest) {
  const servingTarget = parseServingPath(request.nextUrl.pathname);
  if (!servingTarget) return NextResponse.next();
  if (RESERVED_PREFIXES.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // Rewrite to the Node-runtime serving route which touches the database.
  return NextResponse.rewrite(
    new URL(`/~serving/${servingTarget.user}/${servingTarget.project}${servingTarget.path}`, request.url),
  );
}

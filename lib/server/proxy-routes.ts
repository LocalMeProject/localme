/**
 * Reverse proxy (Blueprint §6.2 /api/proxy/{route}, docs §13.5).
 *
 * A project defines a route row with is_proxy=1 and proxy_config
 * { target, headers, timeoutMs }. `{{SECRET_NAME}}` placeholders in header
 * values are substituted from the project's sealed secrets at request time —
 * plaintext never appears in config or logs. The upstream response is streamed
 * back to the caller.
 *
 * The forwarding mechanics live in proxy-forward.ts so project serving can
 * proxy is_proxy routes through the same code path.
 */
import { ApiError } from "@/lib/server/http";
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { forwardProxyRequest, loadSecrets, parseProxyConfig } from "@/lib/server/proxy-forward";
import { handler } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const proxyRequest = handlerProxy(async (request, routePath) => {
  const principal = await requirePrincipal(request);
  const url = new URL(request.url);
  const project = await requireProjectScoped(request, principal, url.searchParams.get("projectId"));

  const db = getDb();
  const p = db.driver;
  const boolLit = p === "sqlite" ? "1" : "TRUE";
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT proxy_config FROM routes
     WHERE project_id = ${placeholder(p, 0)} AND path_pattern = ${placeholder(p, 1)} AND is_proxy = ${boolLit} AND is_active = ${boolLit}`,
    [project.id, routePath],
  );
  if (!rows[0]) throw new ApiError("not_found", "Proxy route not found.");

  const config = parseProxyConfig(rows[0].proxy_config);
  const secrets = await loadSecrets(project.id);
  return forwardProxyRequest(request, config, secrets);
});

/** Handler wrapper for routes with a dynamic /api/proxy/{route} path. */
function handlerProxy(
  fn: (request: Request, routePath: string) => Promise<Response>,
): (request: Request, context: { params: Promise<{ route: string }> }) => Promise<NextResponse> {
  return handler(async (request, { params }) => {
    const { route } = await params;
    const response = await fn(request, `/${route}`);
    return response as NextResponse;
  });
}

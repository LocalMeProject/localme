/**
 * Reverse proxy (Blueprint §6.2 /api/proxy/{route}, docs §13.5).
 *
 * A project defines a route row with is_proxy=1 and proxy_config
 * { target, headers, timeoutMs }. `{{SECRET_NAME}}` placeholders in header
 * values are substituted from the project's sealed secrets at request time —
 * plaintext never appears in config or logs. The upstream response is streamed
 * back to the caller.
 */
import { ApiError } from "@/lib/server/http";
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { decryptSecret } from "@/lib/server/secrets-crypto";

interface ProxyConfig {
  target: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

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

  let config: ProxyConfig;
  try {
    config = JSON.parse(String(rows[0].proxy_config)) as ProxyConfig;
  } catch {
    throw new ApiError("internal_error", "Proxy route has invalid configuration.");
  }
  if (!config?.target || !/^https?:\/\//i.test(config.target)) {
    throw new ApiError("internal_error", "Proxy route target must be an http(s) URL.");
  }

  const secrets = await loadSecrets(project.id);
  const headers = new Headers();
  for (const [name, value] of Object.entries(config.headers ?? {})) {
    headers.set(name, substituteSecrets(value, secrets));
  }
  // Forward the caller's content type so streamed bodies stay usable.
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const targetUrl = new URL(config.target);
  targetUrl.search = url.search;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      signal: controller.signal,
      // @ts-expect-error -- undici-only flag, valid on the Node runtime
      duplex: "half",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    }) as unknown as import("next/server").NextResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("gateway_timeout", "Upstream request timed out.");
    }
    throw new ApiError("bad_gateway", "Upstream request failed.");
  } finally {
    clearTimeout(timeout);
  }
});

/** Handler wrapper for routes with a dynamic /api/proxy/{route} path. */
import { handler } from "@/lib/server/http";
import { NextResponse } from "next/server";

function handlerProxy(
  fn: (request: Request, routePath: string) => Promise<Response>,
): (request: Request, context: { params: Promise<{ route: string }> }) => Promise<NextResponse> {
  return handler(async (request, { params }) => {
    const { route } = await params;
    const response = await fn(request, `/${route}`);
    return response as NextResponse;
  });
}

function substituteSecrets(value: string, secrets: Map<string, string>): string {
  return value.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (match, name) => {
    const secret = secrets.get(name);
    if (secret === undefined) return match; // leave unknown placeholders intact
    return secret;
  });
}

async function loadSecrets(projectId: number): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db.raw<{ key_name: string; encrypted_value: string }>(
    `SELECT key_name, encrypted_value FROM secrets WHERE project_id = ${placeholder(db.driver, 0)}`,
    [projectId],
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    try {
      map.set(row.key_name, decryptSecret(row.encrypted_value));
    } catch {
      // Skip undecryptable entries; substitution leaves the placeholder in place.
    }
  }
  return map;
}

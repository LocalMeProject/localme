/**
 * Shared reverse-proxy forwarding (Blueprint §6.2, docs §13.5).
 *
 * Used by both /api/proxy/{route} (platform API) and project serving for
 * routes with is_proxy=1. `{{SECRET_NAME}}` placeholders in configured header
 * values are substituted from the project's sealed secrets at request time —
 * plaintext never appears in config or logs. The upstream response is
 * streamed back to the caller.
 */
import { ApiError } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { decryptSecret } from "@/lib/server/secrets-crypto";
import { setting } from "@/lib/server/system-config";

export interface ProxyConfig {
  target: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ProxyForwardOptions {
  mountPath?: string;
  callerPath?: string;
}

export const DEFAULT_PROXY_TIMEOUT_MS = 15_000;

export function parseProxyConfig(raw: unknown): ProxyConfig {
  let config: ProxyConfig;
  try {
    config = JSON.parse(String(raw)) as ProxyConfig;
  } catch {
    throw new ApiError("internal_error", "Proxy route has invalid configuration.");
  }
  if (!config?.target || !/^https?:\/\//i.test(config.target)) {
    throw new ApiError("internal_error", "Proxy route target must be an http(s) URL.");
  }
  return config;
}

export function substituteSecrets(value: string, secrets: Map<string, string>): string {
  return value.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (match, name) => {
    const secret = secrets.get(name);
    if (secret === undefined) return match; // leave unknown placeholders intact
    return secret;
  });
}

export async function loadSecrets(projectId: number): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db.raw<{ key_name: string; encrypted_value: string }>(
    `SELECT key_name, encrypted_value FROM secrets WHERE project_id = ${placeholder(db.driver, 0)}`,
    [projectId],
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    try {
      map.set(row.key_name, await decryptSecret(row.encrypted_value));
    } catch {
      // Skip undecryptable entries; substitution leaves the placeholder in place.
    }
  }
  return map;
}

/**
 * The part of the caller's path that sits below a proxy mount, or "" when the
 * route matched exactly (so the configured target path wins).
 */
export function mountRemainder(mountPath: string | undefined, callerPath: string): string {
  if (!mountPath || mountPath === "/") return "";
  if (!callerPath.startsWith(mountPath)) return "";
  const rest = callerPath.slice(mountPath.length);
  return rest === "" || rest === "/" ? "" : rest;
}

/** Forward the request to the configured upstream and stream the response. */
export async function forwardProxyRequest(
  request: Request,
  config: ProxyConfig,
  secrets: Map<string, string>,
  options: ProxyForwardOptions = {},
): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers();
  for (const [name, value] of Object.entries(config.headers ?? {})) {
    headers.set(name, substituteSecrets(value, secrets));
  }
  // Forward the caller's content type so streamed bodies stay usable.
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const targetUrl = new URL(config.target);
  for (const [key, val] of url.searchParams.entries()) {
    targetUrl.searchParams.append(key, val);
  }
  const callerPath = options.callerPath ?? url.pathname;
  const remainder = mountRemainder(options.mountPath, callerPath);
  if (remainder) {
    targetUrl.pathname = `${targetUrl.pathname.replace(/\/+$/, "")}/${remainder.replace(/^\/+/, "")}`;
  }

  // §10 proxy timeouts: the configured default, clamped to the configured max.
  const [configuredDefault, configuredMax] = await Promise.all([
    setting("proxy.default_timeout_seconds"),
    setting("proxy.max_timeout_seconds"),
  ]);
  const requested = config.timeoutMs ?? (configuredDefault > 0 ? configuredDefault * 1000 : DEFAULT_PROXY_TIMEOUT_MS);
  const ceiling = configuredMax > 0 ? configuredMax * 1000 : requested;
  const timeoutMs = Math.min(requested, ceiling);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("gateway_timeout", "Upstream request timed out.");
    }
    throw new ApiError("bad_gateway", "Upstream request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Per-identity rate limiting over the `rate_limits` table (Blueprint §7.3).
 *
 * Fixed windows keyed by (identity, route group, window start); identity is
 * the console session id when present, else `user:<id>`, else `ip:<addr>`.
 * The identity always lands in `session_id` as a synthetic key (`user:5`,
 * `ip:1.2.3.4`) because the table's UNIQUE constraint covers
 * (session_id, window_start, route_pattern) and NULLs never collide — the
 * typed ip/user_id columns stay metadata-only.
 *
 * Counting is read-then-write, so concurrent requests can undercount by one;
 * rate limiting errs toward allowing, which is the safe direction.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "./db/index";
import { placeholder } from "./db/sql";
import { setting } from "./system-config";
import { SESSION_COOKIE } from "./sessions";
import { createLogger } from "./logger";

/** §9.4: limiter faults, never request content. */
const log = createLogger("ratelimit");

/** Documented route groups and their defaults (per minute, §5.11). */
export const ROUTE_GROUPS = {
  auth: { limit: 10, windowSeconds: 60 },
  db: { limit: 120, windowSeconds: 60 },
  storage: { limit: 60, windowSeconds: 60 },
  assets: { limit: 1000, windowSeconds: 60 },
  library: { limit: 1000, windowSeconds: 60 },
  admin: { limit: 600, windowSeconds: 60 },
  default: { limit: 240, windowSeconds: 60 },
} as const;

/** Groups whose whole budget comes from one documented config key (§10). */
const GROUP_TIER_KEY: Partial<Record<RouteGroup, string>> = {
  assets: "rate_limits.asset_requests_per_minute",
  library: "rate_limits.library_requests_per_minute",
  admin: "rate_limits.admin_requests_per_minute",
  // The credential group covers /auth/token, /auth/captcha and /auth/logout.
  // It has to outlast one full lockout sequence: at `auth.max_login_attempts`
  // (5) failures, each attempt spends a captcha fetch and a token post, so a
  // 10/minute budget would 429 the user's *successful* retry. Tunable, because
  // the right number depends on the deployment.
  auth: "rate_limits.auth_requests_per_minute",
};

/**
 * Effective per-minute budget for a group, ignoring the caller's tier.
 *
 * Groups with their own documented key (assets, library, admin, auth) resolve
 * straight from config; the rest fall back to the static default. Anything that
 * needs the group's ceiling — the tests that exhaust a window, the admin
 * console's config view — should call this rather than read
 * `ROUTE_GROUPS[group].limit`, which is only a fallback.
 */
export async function resolveGroupLimit(group: RouteGroup): Promise<number> {
  const tierKey = GROUP_TIER_KEY[group];
  if (tierKey) return Math.max(1, await setting(tierKey));
  return ROUTE_GROUPS[group].limit;
}

/**
 * Effective per-minute budget for a request: the group's budget, bounded by the
 * caller's documented tier (§5.11: API key 600, authenticated 300, anonymous IP
 * fallback 30). Asset/library/admin/auth groups use their own documented tier.
 */
export async function resolveLimit(request: Request, group: RouteGroup): Promise<number> {
  const tierKey = GROUP_TIER_KEY[group];
  if (tierKey) return Math.max(1, await setting(tierKey));
  if (request.headers.get("x-api-key") ?? request.headers.get("authorization")) {
    return Math.max(1, await setting("rate_limits.api_key_requests_per_minute"));
  }
  let hasSession = false;
  try {
    hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    /* cookies() unavailable outside a request scope — treat as anonymous */
  }
  // §10 declares four tiers: the public budget covers an anonymous caller that
  // has already proven it is human (it solved a captcha or holds a visitor
  // cookie); a bare IP gets the much smaller fallback budget.
  const tier = hasSession || hasVisitorCookie(request)
    ? hasSession
      ? "rate_limits.authenticated_requests_per_minute"
      : "rate_limits.public_requests_per_minute"
    : "rate_limits.ip_fallback_requests_per_minute";
  return Math.max(1, Math.min(ROUTE_GROUPS[group].limit, await setting(tier)));
}

/**
 * True when the caller carries any `auth_{projectId}` visitor cookie. Those are
 * issued only after a captcha-gated visitor login, which is what earns the
 * anonymous-but-known caller the `public_requests_per_minute` tier instead of
 * the IP fallback.
 */
function hasVisitorCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(^|;\s*)auth_\d+=/.test(cookie);
}

export type RouteGroup = keyof typeof ROUTE_GROUPS;

/**
 * Map a request path to its documented budget (§5.11 + §10.rate_limits).
 *
 * Applied centrally by `handler()` in ./http.ts so no endpoint can ship
 * unprotected by omission. `/auth/me` deliberately stays in `default` rather
 * than the tight `auth` group: the console polls it on every navigation, and
 * sharing the 10/minute credential budget with it would lock a user out of
 * their own dashboard.
 */
export function rateGroupFor(pathname: string): RouteGroup {
  const p = pathname.toLowerCase();
  if (p.startsWith("/admin") || p.startsWith("/api/admin")) return "admin";
  if (p === "/auth/token" || p === "/auth/captcha" || p === "/auth/logout") return "auth";
  if (p.startsWith("/api/db/")) return "db";
  if (p.startsWith("/api/storage") || p.startsWith("/api/proxy")) return "storage";
  if (p.startsWith("/api/lib") || p.startsWith("/library/")) return "library";
  return "default";
}

function currentWindowStart(windowSeconds: number): string {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
}

async function identityFor(request: Request): Promise<string> {
  // Console session first (strongest identity).
  try {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE)?.value;
    if (raw) return `sid:${raw.split(".")[0]}`;
  } catch {
    /* cookies() unavailable outside a request scope — fall through */
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  return `ip:${ip}`;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check + count one request for an explicit identity (serving paths can't use
 * the session-cookie identity — visitors are anonymous). Same fixed-window
 * semantics as checkRateLimit, keyed as `session_id = identity`.
 */
export async function checkRateLimitForIdentity(
  identity: string,
  group: RouteGroup,
  limitOverride?: number,
): Promise<RateLimitResult> {
  const { windowSeconds } = ROUTE_GROUPS[group];
  // Identity-keyed checks are the serving paths: anonymous visitors (HTML) draw
  // on the IP-fallback tier, assets/library on their own documented tiers.
  const tierKey = GROUP_TIER_KEY[group]
    ?? (group === "default" ? "rate_limits.ip_fallback_requests_per_minute" : "rate_limits.authenticated_requests_per_minute");
  const effectiveLimit = limitOverride ?? Math.max(1, await setting(tierKey));
  const windowStart = currentWindowStart(windowSeconds);
  const db = getDb();
  const p = db.driver;

  const rows = await db.raw<{ request_count: number | string }>(
    `SELECT request_count FROM rate_limits
     WHERE session_id = ${placeholder(p, 0)} AND route_pattern = ${placeholder(p, 1)} AND window_start = ${placeholder(p, 2)}`,
    [identity, group, windowStart],
  );
  const count = Number(rows[0]?.request_count ?? 0) + 1;

  if (rows.length > 0) {
    await db.run(
      `UPDATE rate_limits SET request_count = ${placeholder(p, 0)} WHERE id = (
         SELECT id FROM rate_limits
         WHERE session_id = ${placeholder(p, 1)} AND route_pattern = ${placeholder(p, 2)} AND window_start = ${placeholder(p, 3)}
       )`,
      [count, identity, group, windowStart],
    );
  } else {
    await db.run(
      `INSERT INTO rate_limits (session_id, route_pattern, window_start, request_count)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [identity, group, windowStart, count],
    );
  }

  const allowed = count <= effectiveLimit;
  const retryAfterSeconds = allowed ? 0 : Math.max(1, windowSeconds - Math.floor((Date.now() - Date.parse(windowStart)) / 1000));
  return { allowed, remaining: Math.max(0, effectiveLimit - count), retryAfterSeconds };
}

/** Check + count one request against the group's window. */
export async function checkRateLimit(request: Request, group: RouteGroup): Promise<RateLimitResult> {
  const { windowSeconds } = ROUTE_GROUPS[group];
  const limit = await resolveLimit(request, group);
  const identity = await identityFor(request);
  const windowStart = currentWindowStart(windowSeconds);
  const db = getDb();
  const p = db.driver;

  const rows = await db.raw<{ request_count: number | string }>(
    `SELECT request_count FROM rate_limits
     WHERE session_id = ${placeholder(p, 0)} AND route_pattern = ${placeholder(p, 1)} AND window_start = ${placeholder(p, 2)}`,
    [identity, group, windowStart],
  );
  const count = Number(rows[0]?.request_count ?? 0) + 1;

  if (rows.length > 0) {
    await db.run(
      `UPDATE rate_limits SET request_count = ${placeholder(p, 0)} WHERE id = (
         SELECT id FROM rate_limits
         WHERE session_id = ${placeholder(p, 1)} AND route_pattern = ${placeholder(p, 2)} AND window_start = ${placeholder(p, 3)}
       )`,
      [count, identity, group, windowStart],
    );
  } else {
    // Housekeeping: drop this identity's windows older than an hour.
    await db.run(
      `DELETE FROM rate_limits WHERE session_id = ${placeholder(p, 0)} AND window_start < ${placeholder(p, 1)}`,
      [identity, new Date(Date.now() - 3_600_000).toISOString()],
    );
    await db.run(
      `INSERT INTO rate_limits (session_id, route_pattern, window_start, request_count)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [identity, group, windowStart, count],
    );
  }

  const allowed = count <= limit;
  const retryAfterSeconds = allowed ? 0 : Math.max(1, windowSeconds - Math.floor((Date.now() - Date.parse(windowStart)) / 1000));
  return { allowed, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

/**
 * Enforce a rate limit inside a route handler. Returns a 429 response when the
 * identity is over the group's window, or null to proceed.
 *
 * Bookkeeping failures are swallowed. The limiter is a protection, not a
 * correctness gate: if its own table is missing (an unmigrated database) or the
 * write fails, failing the request would turn an otherwise-fine 401 into a 500
 * and take the whole API offline. Opening the gate is the lesser failure — the
 * alternative is an outage caused by the thing meant to prevent one. The
 * failure is logged so it is not silent.
 */
export async function enforceRateLimit(
  request: Request,
  group: RouteGroup,
): Promise<NextResponse | null> {
  let result: RateLimitResult;
  try {
    result = await checkRateLimit(request, group);
  } catch (error) {
    log.error("rate_limit_check_failed", {
      method: request.method,
      path: new URL(request.url).pathname,
      group,
      error,
    });
    return null;
  }
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Rate limit exceeded, slow down.", code: "rate_limited" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterSeconds))) },
    },
  );
}

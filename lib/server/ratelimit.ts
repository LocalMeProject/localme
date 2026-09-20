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

import { getDb } from "./db/index";
import { placeholder } from "./db/sql";
import { apiRateLimited } from "./http";
import { SESSION_COOKIE } from "./sessions";

/** Documented route groups and their defaults (per minute). */
export const ROUTE_GROUPS = {
  auth: { limit: 10, windowSeconds: 60 },
  db: { limit: 120, windowSeconds: 60 },
  storage: { limit: 60, windowSeconds: 60 },
  default: { limit: 240, windowSeconds: 60 },
} as const;

export type RouteGroup = keyof typeof ROUTE_GROUPS;

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

/** Check + count one request against the group's window. */
export async function checkRateLimit(request: Request, group: RouteGroup): Promise<RateLimitResult> {
  const { limit, windowSeconds } = ROUTE_GROUPS[group];
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
 */
export async function enforceRateLimit(
  request: Request,
  group: RouteGroup,
): Promise<ReturnType<typeof apiRateLimited> | null> {
  const result = await checkRateLimit(request, group);
  if (result.allowed) return null;
  return apiRateLimited(result.retryAfterSeconds);
}

/**
 * Overview statistics, dashboard metrics, and session revocation.
 */
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { bind, log, requireFullAdmin, requireOperator } from "./common";

/** GET /api/admin/stats — platform totals for the admin dashboard. */
export const adminStats = handler(async (request) => {
  await requireOperator(request);
  const db = getDb();
  const [users, projects, visits, storage] = await Promise.all([
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM users`),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM projects`),
    db.raw<{ n: number | string; month: number | string }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN visited_at >= ${placeholder(db.driver, 1)} THEN 1 ELSE 0 END), 0) AS month
       FROM visit_logs`,
      [`${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`],
    ),
    db.raw<{ n: number | string }>(`SELECT COALESCE(SUM(size_bytes), 0) AS n FROM files`),
  ]);
  return apiOk({
    users: Number(users[0]?.n ?? 0),
    projects: Number(projects[0]?.n ?? 0),
    visitsAllTime: Number(visits[0]?.n ?? 0),
    visitsThisMonth: Number(visits[0]?.month ?? 0),
    storageBytes: Number(storage[0]?.n ?? 0),
  });
});

/** GET /api/admin/overview — the headline numbers and busiest projects. */
export const adminOverview = handler(async (request) => {
  const { username, isAdmin, isOperator } = await requireOperator(request);
  const db = getDb();
  const p = db.driver;
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [
    users,
    suspended,
    locked,
    week,
    day,
    newProjects,
    newUsers,
    topProjects,
    storageTotal,
    activeKeys,
    idleKeys,
    activeHooks,
    failedDeliveries,
    verifiedDomains,
    enabledCron,
    liveSessions,
  ] =
    await Promise.all([
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM users`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM users WHERE is_suspended = ${bind(true)}`,
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM users WHERE locked_until IS NOT NULL AND locked_until > ${placeholder(p, 0)}`,
      [new Date().toISOString()],
    ),
    db.raw<{ visits: number | string; unique_visitors: number | string }>(
      `SELECT COUNT(*) AS visits, COUNT(DISTINCT ip) AS unique_visitors
       FROM visit_logs WHERE visited_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<{ visits: number | string; unique_visitors: number | string }>(
      `SELECT COUNT(*) AS visits, COUNT(DISTINCT ip) AS unique_visitors FROM visit_logs WHERE visited_at >= ${placeholder(p, 0)}`,
      [dayAgo],
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM projects WHERE created_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM users WHERE created_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<Record<string, unknown>>(
      `SELECT pr.id, pr.name, u.username, COUNT(v.id) AS visits
       FROM visit_logs v JOIN projects pr ON pr.id = v.project_id JOIN users u ON u.id = pr.user_id
       WHERE v.visited_at >= ${placeholder(p, 0)}
       GROUP BY pr.id, pr.name, u.username ORDER BY visits DESC LIMIT 5`,
      [weekAgo],
    ),
    // Health KPIs an operator actually acts on: what is consuming the database,
    // what is running, and what is stuck.
    db.raw<{ total: number | string }>(`SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files`),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL AND (last_used_at IS NULL OR last_used_at < ${placeholder(p, 0)})`,
      [new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()],
    ),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM webhooks WHERE is_active = ${bind(true)}`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM webhook_deliveries WHERE error_message IS NOT NULL AND delivered_at >= ${placeholder(p, 0)}`,
      [weekAgo],
    ),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM domains WHERE is_verified = ${bind(true)}`,
    ),
    db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM cron_configs WHERE is_enabled = ${bind(true)}`),
    db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ${placeholder(p, 0)}`,
      [new Date().toISOString()],
    ),
    ]);

  return apiOk({
    users: Number(users[0]?.n ?? 0),
    suspendedUsers: Number(suspended[0]?.n ?? 0),
    lockedUsers: Number(locked[0]?.n ?? 0),
    newProjectsThisWeek: Number(newProjects[0]?.n ?? 0),
    week: {
      visits: Number(week[0]?.visits ?? 0),
      uniqueVisitors: Number(week[0]?.unique_visitors ?? 0),
      newUsers: Number(newUsers[0]?.n ?? 0),
      since: weekAgo,
    },
    last24h: {
      visits: Number(day[0]?.visits ?? 0),
      uniqueVisitors: Number(day[0]?.unique_visitors ?? 0),
    },
    // The console needs its own tier to hide the admin-only controls rather
    // than offering buttons that come back 403.
    viewer: { username, isAdmin, isOperator },
    health: {
      storageBytes: Number(storageTotal[0]?.total ?? 0),
      activeApiKeys: Number(activeKeys[0]?.n ?? 0),
      idleApiKeys: Number(idleKeys[0]?.n ?? 0),
      activeWebhooks: Number(activeHooks[0]?.n ?? 0),
      failedDeliveriesThisWeek: Number(failedDeliveries[0]?.n ?? 0),
      verifiedDomains: Number(verifiedDomains[0]?.n ?? 0),
      enabledCronTasks: Number(enabledCron[0]?.n ?? 0),
      liveSessions: Number(liveSessions[0]?.n ?? 0),
    },
    topProjects: topProjects.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      username: String(row.username),
      visits: Number(row.visits ?? 0),
    })),
  });
});

/** DELETE /api/admin/sessions?userId=N — sign an account out everywhere. */
export const adminSessionsRevoke = handler(async (request) => {
  const { username: principalName, isAdmin } = await requireOperator(request);
  const principal = { username: principalName };
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError("bad_request", "userId query parameter is required.");
  }
  // Signing an admin out everywhere is a denial-of-service primitive against
  // the platform's own administrators, so it stays an admin action.
  if (!isAdmin) {
    const rows = await getDb().raw<{ is_admin: number | boolean }>(
      `SELECT is_admin FROM users WHERE id = ${placeholder(getDb().driver, 0)}`,
      [userId],
    );
    if (rows[0] && (rows[0].is_admin === 1 || rows[0].is_admin === true)) requireFullAdmin(false);
  }
  const db = getDb();
  const result = await db.run(`DELETE FROM sessions WHERE user_id = ${placeholder(db.driver, 0)}`, [
    userId,
  ]);
  log.warn("admin.sessions_revoked", { by: principal.username, userId, revoked: result.changes });
  return apiOk({ success: true, revoked: result.changes });
});

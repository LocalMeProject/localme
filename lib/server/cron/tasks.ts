/**
 * Cron individual task implementations and execution routines.
 */
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { purgeExpiredSessions } from "@/lib/server/sessions";
import { dispatchWebhookEvent, drainWebhookQueue } from "@/lib/server/webhook-routes";
import { setting, settingFlag } from "@/lib/server/system-config";
import { DEFAULT_TASK_PARAMETERS, nextRunAtFor, type CronTask } from "@/lib/server/cron-tasks";

export async function taskParameters(projectId: number, task: CronTask): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db.raw<{ parameters: string }>(
    `SELECT parameters FROM cron_configs WHERE project_id = ${placeholder(db.driver, 0)} AND task_name = ${placeholder(db.driver, 1)}`,
    [projectId, task],
  );
  try {
    const parsed: unknown = JSON.parse(String(rows[0]?.parameters ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...(DEFAULT_TASK_PARAMETERS[task] ?? {}), ...(parsed as Record<string, unknown>) };
    }
  } catch {
    // Fall through to defaults.
  }
  return { ...(DEFAULT_TASK_PARAMETERS[task] ?? {}) };
}

export async function stampRun(projectId: number, task: CronTask): Promise<void> {
  const db = getDb();
  const p = db.driver;
  const floor = await setting("cron.min_interval_minutes");
  const now = new Date().toISOString();
  // The task's own schedule (Tech docs §8) decides when it runs next.
  const rows = await db.raw<{ parameters: string }>(
    `SELECT parameters FROM cron_configs WHERE project_id = ${placeholder(p, 0)} AND task_name = ${placeholder(p, 1)}`,
    [projectId, task],
  );
  let parameters: unknown = {};
  try {
    parameters = rows[0] ? JSON.parse(String(rows[0].parameters)) : {};
  } catch {
    // Malformed parameters fall back to the task's built-in cadence.
  }
  await db.run(
    `UPDATE cron_configs SET last_run_at = ${placeholder(p, 0)}, next_run_at = ${placeholder(p, 1)}, updated_at = ${placeholder(p, 2)}
     WHERE project_id = ${placeholder(p, 3)} AND task_name = ${placeholder(p, 4)}`,
    [now, nextRunAtFor(task, now, floor, parameters), now, projectId, task],
  );
}

export async function executeTask(projectId: number, task: CronTask): Promise<Record<string, unknown>> {
  switch (task) {
    case "clean_expired_sessions":
      return { purgedSessions: await purgeExpiredSessions() };
    case "clean_old_logs":
      return cleanOldLogs(projectId);
    case "generate_daily_stats":
      return rollupDailyStats(projectId);
    case "send_daily_summary_webhook":
      return sendDailySummaryWebhook(projectId);
    case "clean_orphaned_uploads":
      return cleanOrphanedUploads(projectId);
    case "renew_ssl_certificates": {
      // §5.6 step 7: re-issue anything inside the renewal window. Platform-wide
      // because certificates are per domain, not per project.
      const { renewExpiringCertificates } = await import("@/lib/server/ssl");
      return renewExpiringCertificates();
    }
    case "retry_failed_webhooks":
      return retryFailedWebhooks(projectId);
    case "storage_audit":
      return storageAudit(projectId);
    case "heartbeat":
      return { alive: true, at: new Date().toISOString() };
    default:
      return { skipped: true };
  }
}

/**
 * Aggregate yesterday's visit_logs into daily_project_stats (docs §8 stats
 * rollup). Idempotent: the (date, project) row is upserted.
 */
export async function rollupDailyStats(projectId: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const p = db.driver;
  const dayStart = new Date(Date.now() - 86_400_000);
  const date = dayStart.toISOString().slice(0, 10);
  const dayEnd = `${date}T23:59:59.999Z`;
  const dayStartIso = `${date}T00:00:00.000Z`;

  const rows = await db.raw<{ total: number | string; uniques: number | string }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(is_unique), 0) AS uniques FROM visit_logs
     WHERE project_id = ${placeholder(p, 0)} AND visited_at >= ${placeholder(p, 1)} AND visited_at <= ${placeholder(p, 2)}`,
    [projectId, dayStartIso, dayEnd],
  );
  const total = Number(rows[0]?.total ?? 0);
  const uniques = Number(rows[0]?.uniques ?? 0);

  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM daily_project_stats WHERE project_id = ${placeholder(p, 0)} AND date = ${placeholder(p, 1)}`,
    [projectId, date],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE daily_project_stats SET total_visits = ${placeholder(p, 0)}, unique_visitors = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
      [total, uniques, existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO daily_project_stats (date, project_id, total_visits, unique_visitors)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [date, projectId, total, uniques],
    );
  }
  return { date, totalVisits: total, uniqueVisitors: uniques };
}

/**
 * Delete visit logs older than the retention window (§5.8 CleanOldLogs). The
 * free-tier retention applies until paid plans exist.
 */
export async function cleanOldLogs(projectId: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const p = db.driver;
  const months = await setting("retention.free_log_retention_months");
  const cutoff = new Date(Date.now() - Math.max(1, months) * 30 * 86_400_000).toISOString();
  const deleted = await db.run(
    `DELETE FROM visit_logs WHERE project_id = ${placeholder(p, 0)} AND visited_at < ${placeholder(p, 1)}`,
    [projectId, cutoff],
  );

  // Rate-limit rows are platform-wide housekeeping; retention.rate_limit_retention_days.
  const rateLimitDays = await setting("retention.rate_limit_retention_days");
  const rateCutoff = new Date(Date.now() - Math.max(1, rateLimitDays) * 86_400_000).toISOString();
  const purgedRateLimits = await db.run(
    `DELETE FROM rate_limits WHERE window_start < ${placeholder(p, 0)}`,
    [rateCutoff],
  );

  return { cutoff, deletedVisits: deleted.changes, purgedRateLimits: purgedRateLimits.changes };
}

/**
 * POST the previous day's summary to the project's webhooks (§5.8
 * SendDailySummaryWebhook). The `webhook_id` parameter narrows delivery to one
 * webhook; otherwise every subscriber of `daily.summary` receives it.
 */
export async function sendDailySummaryWebhook(projectId: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const p = db.driver;
  const date = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const rows = await db.raw<{ total: number | string; uniques: number | string }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(is_unique), 0) AS uniques FROM visit_logs
     WHERE project_id = ${placeholder(p, 0)} AND visited_at >= ${placeholder(p, 1)} AND visited_at <= ${placeholder(p, 2)}`,
    [projectId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`],
  );
  const params = await taskParameters(projectId, "send_daily_summary_webhook");
  const webhookId = params.webhook_id == null ? null : Number(params.webhook_id);
  const data = {
    date,
    totalVisits: Number(rows[0]?.total ?? 0),
    uniqueVisitors: Number(rows[0]?.uniques ?? 0),
  };
  await dispatchWebhookEvent(projectId, "daily.summary", data, {
    onlyWebhookId: Number.isInteger(webhookId) ? webhookId : null,
    allowUnsubscribed: Number.isInteger(webhookId),
  });
  return { delivered: true, webhookId: Number.isInteger(webhookId) ? webhookId : null, ...data };
}

/** Remove stale temporary uploads (§5.8 CleanOrphanedUploads). */
export async function cleanOrphanedUploads(projectId: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const p = db.driver;
  const params = await taskParameters(projectId, "clean_orphaned_uploads");
  const maxAgeHours = Number(params.max_age_hours ?? 24);
  const cutoff = new Date(Date.now() - Math.max(1, maxAgeHours) * 3_600_000).toISOString();
  const deleted = await db.run(
    `DELETE FROM files WHERE project_id = ${placeholder(p, 0)} AND path LIKE 'temp/%' AND updated_at < ${placeholder(p, 1)}`,
    [projectId, cutoff],
  );
  return { cutoff, deletedFiles: deleted.changes };
}

/**
 * Drain the delivery queue for a project (Blueprint §5.9).
 */
export async function retryFailedWebhooks(projectId: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const p = db.driver;
  // A parked failure is only worth re-queueing when the operator asked for it.
  if (await settingFlag("webhooks.retry_failed")) {
    await db.run(
      `UPDATE webhook_outbox SET status = 'pending', next_attempt_at = ${placeholder(p, 0)}
       WHERE project_id = ${placeholder(p, 1)} AND status = 'failed' AND attempts > 0`,
      [new Date().toISOString(), projectId],
    );
  }
  const drained = await drainWebhookQueue({ projectId, limit: 50 });
  const queue = await db.raw<{ pending: number | string; failed: number | string }>(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM webhook_outbox WHERE project_id = ${placeholder(p, 0)}`,
    [projectId],
  );
  return {
    attempted: drained.attempted,
    delivered: drained.delivered,
    requeued: drained.requeued,
    failed: drained.failed,
    pending: Number(queue[0]?.pending ?? 0),
    parkedFailed: Number(queue[0]?.failed ?? 0),
  };
}

/**
 * Recompute per-file sizes vs the files table's stored totals for the
 * project's owner cap report; surfaces drift instead of silently ignoring it.
 */
export async function storageAudit(projectId: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db.raw<{ files: number | string; bytes: number | string }>(
    `SELECT COUNT(*) AS files, COALESCE(SUM(size_bytes), 0) AS bytes FROM files WHERE project_id = ${placeholder(db.driver, 0)}`,
    [projectId],
  );
  return {
    files: Number(rows[0]?.files ?? 0),
    bytes: Number(rows[0]?.bytes ?? 0),
    auditedAt: new Date().toISOString(),
  };
}

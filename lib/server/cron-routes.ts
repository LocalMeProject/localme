/**
 * Cron task configuration + execution (Blueprint §5.8 /api/cron).
 *
 * Eight tasks ship with every project — the five documented built-ins plus
 * three platform maintenance tasks. Each project can toggle tasks, edit their
 * parameters (`retention_days`, `max_age_hours`, `webhook_id`) and run one on
 * demand. Unattended execution is the platform runner hitting
 * `POST /api/cron/run` with the `PLATFORM_CRON_TOKEN`; that sweeps every
 * enabled task whose `next_run_at` has passed. Project toggles are honoured, and
 * `cron.task.<name>.enabled` is the admin's global switch (§5.8 admin control).
 */
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePermission, requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { purgeExpiredSessions } from "@/lib/server/sessions";
import { dispatchWebhookEvent, drainWebhookQueue } from "@/lib/server/webhook-routes";
import { createLogger } from "@/lib/server/logger";
import { parseCronExpression, scheduleIsReachable } from "@/lib/server/cron-schedule";
import { setting, settingFlag } from "@/lib/server/system-config";
import {
  BUILTIN_TASKS,
  CRON_TASKS,
  DEFAULT_TASK_PARAMETERS,
  cronGlobalKey,
  nextRunAtFor,
  type CronTask,
} from "@/lib/server/cron-tasks";

export { BUILTIN_TASKS, CRON_TASKS };

/** Cron logs (§9.4): task lifecycle and failures, no payload contents. */
const log = createLogger("cron");

const taskEnum = z.enum(CRON_TASKS);

const toggleSchema = z.object({
  task: taskEnum,
  isEnabled: z.boolean(),
  parameters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

const runSchema = z.object({
  task: taskEnum.optional(),
  /** Platform-runner mode: run every task that is due. */
  due: z.boolean().optional(),
});

async function scopedProject(request: Request, projectIdParam: string | null) {
  const principal = await requirePrincipal(request);
  const project = await requireProjectScoped(request, principal, projectIdParam);
  requirePermission(principal, "cron_manage");
  return project;
}

/** GET /api/cron?projectId=N — task configuration for one owned project. */
export const cronList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT task_name, is_enabled, parameters, last_run_at, next_run_at FROM cron_configs
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY task_name`,
    [project.id],
  );
  const configured = new Set(rows.map((row) => String(row.task_name)));
  const data = rows.map(mapCron);
  // Tasks added after the project was created get their defaults on read.
  for (const task of CRON_TASKS) {
    if (!configured.has(task)) {
      data.push({
        task,
        isEnabled: true,
        parameters: { ...(DEFAULT_TASK_PARAMETERS[task] ?? {}) },
        lastRunAt: null,
        nextRunAt: null,
      });
    }
  }
  data.sort((a, b) => a.task.localeCompare(b.task));
  return apiOk({ data, available: [...CRON_TASKS], builtin: [...BUILTIN_TASKS] });
});

interface CronRow {
  task: CronTask;
  isEnabled: boolean;
  parameters: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

function mapCron(row: Record<string, unknown>): CronRow {
  const task = String(row.task_name) as CronTask;
  let parameters: Record<string, unknown> = { ...(DEFAULT_TASK_PARAMETERS[task] ?? {}) };
  try {
    const parsed: unknown = JSON.parse(String(row.parameters ?? "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parameters = { ...parameters, ...(parsed as Record<string, unknown>) };
    }
  } catch {
    // Malformed parameters fall back to the documented defaults.
  }
  return {
    task,
    isEnabled: row.is_enabled === 1 || row.is_enabled === true,
    parameters,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    nextRunAt: (row.next_run_at as string | null) ?? null,
  };
}

/** PUT /api/cron?projectId=N — toggle a task and/or edit its parameters. */
export const cronToggle = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, toggleSchema);
  const db = getDb();
  const p = db.driver;
  const existing = await db.raw<{ id: number; parameters: string }>(
    `SELECT id, parameters FROM cron_configs WHERE project_id = ${placeholder(p, 0)} AND task_name = ${placeholder(p, 1)}`,
    [project.id, body.task],
  );
  // Postgres BOOLEAN rejects integer binds; SQLite INTEGER rejects booleans.
  const enabledValue = p === "sqlite" ? (body.isEnabled ? 1 : 0) : body.isEnabled;
  const merged = { ...(DEFAULT_TASK_PARAMETERS[body.task] ?? {}), ...(body.parameters ?? {}) };
  // Tech docs §8: a task may carry its own schedule. Reject an unparseable one
  // here rather than storing a value that would never fire.
  if (typeof merged.schedule === "string" && merged.schedule.trim()) {
    const schedule = parseCronExpression(merged.schedule);
    if (!schedule) {
      throw new ApiError("bad_request", "schedule must be a 5-field cron expression, e.g. \"*/15 * * * *\".");
    }
    if (!scheduleIsReachable(schedule)) {
      throw new ApiError("bad_request", `schedule "${schedule.expression}" can never fire.`);
    }
  }
  if (
    merged.every_minutes !== undefined &&
    (typeof merged.every_minutes !== "number" || merged.every_minutes <= 0)
  ) {
    throw new ApiError("bad_request", "every_minutes must be a positive number.");
  }
  const parameters = JSON.stringify(merged);

  if (existing[0]) {
    await db.run(
      `UPDATE cron_configs SET is_enabled = ${placeholder(p, 0)}, parameters = ${placeholder(p, 1)}, updated_at = ${placeholder(p, 2)}
       WHERE id = ${placeholder(p, 3)}`,
      [enabledValue, parameters, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO cron_configs (project_id, task_name, is_enabled, parameters)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [project.id, body.task, enabledValue, parameters],
    );
  }
  return apiOk({ success: true, task: body.task, isEnabled: body.isEnabled, parameters: merged });
});

/**
 * POST /api/cron/run — run one task for a project, or (with the platform token)
 * sweep every due task across all projects.
 */
export const cronRun = handler(async (request) => {
  const url = new URL(request.url);
  const projectIdParam = url.searchParams.get("projectId");
  const body = await parseJson(request, runSchema);

  if (isPlatformRun(request)) {
    if (!body.task && !body.due && projectIdParam === null) {
      // Explicit task from the runner for a single project is pointless without
      // a projectId; treat a bare platform call as a due-task sweep.
      return apiOk({ success: true, sweep: await platformCronSweep() });
    }
    if (body.due || !body.task) {
      return apiOk({ success: true, sweep: await platformCronSweep() });
    }
  }

  const project = await scopedProject(request, projectIdParam);
  const task = body.task;
  if (!task) throw new ApiError("bad_request", "task is required.");
  const result = await runCronTask(project.id, task, { notify: true });
  return apiOk({ success: true, task, result });
});

/** True when the request carries the platform runner's token. */
function isPlatformRun(request: Request): boolean {
  const expected = process.env.PLATFORM_CRON_TOKEN;
  if (!expected) return false;
  const presented = request.headers.get("x-cron-token") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Execute one task; returns a small result summary. */
export async function runCronTask(
  projectId: number,
  task: CronTask,
  options: { notify?: boolean } = {},
): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  log.info("cron_task_started", { projectId, task });
  if (options.notify) {
    void dispatchWebhookEvent(projectId, "cron.started", { task, startedAt }).catch(() => undefined);
  }

  let result: Record<string, unknown>;
  try {
    result = await executeTask(projectId, task);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("cron_task_failed", { projectId, task, error: message });
    if (options.notify) {
      void dispatchWebhookEvent(projectId, "cron.failed", { task, error: message }).catch(() => undefined);
    }
    await stampRun(projectId, task);
    throw new ApiError("internal_error", `Cron task ${task} failed: ${message}`);
  }

  await stampRun(projectId, task);
  log.info("cron_task_completed", { projectId, task });
  if (options.notify) {
    void dispatchWebhookEvent(projectId, "cron.completed", { task, result }).catch(() => undefined);
  }
  return result;
}

async function executeTask(projectId: number, task: CronTask): Promise<Record<string, unknown>> {
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

async function taskParameters(projectId: number, task: CronTask): Promise<Record<string, unknown>> {
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

async function stampRun(projectId: number, task: CronTask): Promise<void> {
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

/**
 * Platform runner sweep: run every enabled, globally-enabled task whose
 * `next_run_at` has passed, capped by `cron.max_concurrent_jobs` and throttled
 * by `cron.min_interval_minutes`.
 */
export async function platformCronSweep(): Promise<{
  ran: Array<{ projectId: number; task: string; result: Record<string, unknown> }>;
  skipped: Array<{ projectId: number; task: string; reason: string }>;
}> {
  const db = getDb();
  const p = db.driver;
  const now = new Date().toISOString();
  const maxConcurrent = Math.max(1, await setting("cron.max_concurrent_jobs"));
  const minInterval = await setting("cron.min_interval_minutes");
  const taskTimeoutMs = Math.max(1, await setting("cron.timeout_seconds")) * 1000;

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT c.project_id, c.task_name, c.last_run_at, c.next_run_at
     FROM cron_configs c
     JOIN projects pr ON pr.id = c.project_id
     JOIN users u ON u.id = pr.user_id
     WHERE c.is_enabled = ${p === "sqlite" ? 1 : "TRUE"}
       AND u.is_suspended = ${p === "sqlite" ? 0 : "FALSE"}
       AND pr.is_active = ${p === "sqlite" ? 1 : "TRUE"}
       AND (c.next_run_at IS NULL OR c.next_run_at <= ${placeholder(p, 0)})
     ORDER BY c.next_run_at ASC`,
    [now],
  );

  const ran: Array<{ projectId: number; task: string; result: Record<string, unknown> }> = [];
  const skipped: Array<{ projectId: number; task: string; reason: string }> = [];

  for (const row of rows) {
    if (ran.length >= maxConcurrent) break;
    const task = String(row.task_name) as CronTask;
    const projectId = Number(row.project_id);
    if (!(CRON_TASKS as readonly string[]).includes(task)) {
      skipped.push({ projectId, task, reason: "unknown task" });
      continue;
    }
    if (!(await settingFlag(cronGlobalKey(task)))) {
      skipped.push({ projectId, task, reason: "disabled globally" });
      continue;
    }
    const lastRun = row.last_run_at ? Date.parse(String(row.last_run_at)) : NaN;
    if (Number.isFinite(lastRun) && Date.now() - lastRun < minInterval * 60_000) {
      skipped.push({ projectId, task, reason: "min_interval_minutes" });
      continue;
    }
    try {
      // §10.cron.timeout_seconds bounds a single task. Without it one hung
      // task — a webhook that never answers, a storage scan over a large
      // account — stalls the whole sweep for every project behind it.
      const result = await withTimeout(
        runCronTask(projectId, task, { notify: true }),
        taskTimeoutMs,
        `exceeded cron.timeout_seconds (${Math.round(taskTimeoutMs / 1000)}s)`,
      );
      ran.push({ projectId, task, result });
    } catch (error) {
      skipped.push({
        projectId,
        task,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { ran, skipped };
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
 *
 * This is the "BackgroundService" half of the spec: dispatch enqueues, and this
 * task — or the inline drain that follows a dispatch — delivers. Rows left
 * `pending` by a crash are picked up here, and rows parked in `failed` are only
 * retried when `webhooks.retry_failed` is on, because §5.9 states "Retry: No
 * retries (as per requirement)".
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
export async function storageAudit(projectId: number): Promise<Record<string, unknown>> {  const db = getDb();
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

/**
 * Reject with `message` if `work` has not settled within `ms`.
 *
 * This bounds the *wait*, not the underlying work: a task that ignores its
 * own I/O timeouts keeps running in the background. That is the right trade
 * here — a detached promise cannot be cancelled mid-`await` — because the point
 * is to stop one slow project from holding up every other project's schedule.
 */
async function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    // Never let a rejected task become an unhandled rejection after the race
    // has already been decided.
    void work.catch(() => undefined);
  }
}

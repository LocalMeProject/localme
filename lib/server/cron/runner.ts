/**
 * Cron runner: single task execution and platform-wide due-task sweeps.
 */
import { ApiError } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { dispatchWebhookEvent } from "@/lib/server/webhook-routes";
import { setting, settingFlag } from "@/lib/server/system-config";
import { CRON_TASKS, cronGlobalKey, type CronTask } from "@/lib/server/cron-tasks";
import { log, withTimeout } from "./common";
import { executeTask, stampRun } from "./tasks";

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
      // §10.cron.timeout_seconds bounds a single task.
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

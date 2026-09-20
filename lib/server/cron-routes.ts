/**
 * Cron task configuration + run-on-demand (Blueprint §6.3 /api/cron).
 *
 * Five built-in task names per project (session cleanup, stats rollup,
 * webhook retry, storage audit, heartbeat) can be toggled and executed on
 * demand; actual scheduling is done by the platform cron runner hitting
 * POST /api/cron/run with the platform token.
 */
import { z } from "zod";
import { apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { purgeExpiredSessions } from "@/lib/server/sessions";

export const BUILTIN_TASKS = [
  "clean_expired_sessions",
  "rollup_daily_stats",
  "retry_failed_webhooks",
  "storage_audit",
  "heartbeat",
] as const;

const toggleSchema = z.object({
  task: z.enum(BUILTIN_TASKS),
  isEnabled: z.boolean(),
});

const runSchema = z.object({ task: z.enum(BUILTIN_TASKS) });

async function scopedProject(request: Request, projectIdParam: string | null) {
  const principal = await requirePrincipal(request);
  return requireProjectScoped(request, principal, projectIdParam);
}

export const cronList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT task_name, is_enabled, last_run_at, next_run_at FROM cron_configs
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY task_name`,
    [project.id],
  );
  return apiOk({ data: rows.map(mapCron), available: BUILTIN_TASKS });
});

function mapCron(row: Record<string, unknown>) {
  return {
    task: String(row.task_name),
    isEnabled: row.is_enabled === 1 || row.is_enabled === true,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    nextRunAt: (row.next_run_at as string | null) ?? null,
  };
}

/** PUT /api/cron — toggle a built-in task for the project (upserts the row). */
export const cronToggle = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, toggleSchema);
  const db = getDb();
  const p = db.driver;
  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM cron_configs WHERE project_id = ${placeholder(p, 0)} AND task_name = ${placeholder(p, 1)}`,
    [project.id, body.task],
  );
  // Postgres BOOLEAN rejects integer binds; SQLite INTEGER rejects booleans.
  const enabledValue = p === "sqlite" ? (body.isEnabled ? 1 : 0) : body.isEnabled;
  if (existing[0]) {
    await db.run(`UPDATE cron_configs SET is_enabled = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`, [
      enabledValue,
      existing[0].id,
    ]);
  } else {
    await db.run(
      `INSERT INTO cron_configs (project_id, task_name, is_enabled) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
      [project.id, body.task, enabledValue],
    );
  }
  return apiOk({ success: true, task: body.task, isEnabled: body.isEnabled });
});

/** POST /api/cron/run — execute a task now and stamp last_run_at. */
export const cronRun = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, runSchema);
  const result = await runCronTask(project.id, body.task);
  return apiOk({ success: true, task: body.task, result });
});

/** Execute one built-in task; returns a small result summary. */
export async function runCronTask(
  projectId: number,
  task: (typeof BUILTIN_TASKS)[number],
): Promise<Record<string, unknown>> {
  const db = getDb();
  const p = db.driver;
  let result: Record<string, unknown>;

  switch (task) {
    case "clean_expired_sessions": {
      const purged = await purgeExpiredSessions();
      result = { purgedSessions: purged };
      break;
    }
    case "heartbeat": {
      result = { alive: true, at: new Date().toISOString() };
      break;
    }
    case "rollup_daily_stats":
    case "retry_failed_webhooks":
    case "storage_audit":
    default: {
      // Implemented with the serving/analytics milestones; safe no-op today.
      result = { skipped: true };
      break;
    }
  }

  await db.run(
    `UPDATE cron_configs SET last_run_at = ${placeholder(p, 0)} WHERE project_id = ${placeholder(p, 1)} AND task_name = ${placeholder(p, 2)}`,
    [new Date().toISOString(), projectId, task],
  );
  return result;
}

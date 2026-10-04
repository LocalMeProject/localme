/**
 * HTTP route handlers for cron configuration and execution.
 */
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { parseCronExpression, scheduleIsReachable } from "@/lib/server/cron-schedule";
import {
  BUILTIN_TASKS,
  CRON_TASKS,
  DEFAULT_TASK_PARAMETERS,
  type CronTask,
} from "@/lib/server/cron-tasks";
import { isPlatformRun, runSchema, scopedProject, toggleSchema } from "./common";
import { platformCronSweep, runCronTask } from "./runner";

export interface CronRow {
  task: CronTask;
  isEnabled: boolean;
  parameters: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function mapCron(row: Record<string, unknown>): CronRow {
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

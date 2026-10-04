/**
 * Admin endpoints for platform cron tasks.
 */
import { z } from "zod";
import { apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { CRON_TASKS, cronGlobalKey } from "@/lib/server/cron-tasks";
import { invalidateConfig, settingFlag } from "@/lib/server/system-config";
import { requireOperator } from "./common";

/** GET /api/admin/cron — per-task global switches plus due counts (§6.4). */
export const adminCronGet = handler(async (request) => {
  await requireOperator(request);
  const db = getDb();
  const now = new Date().toISOString();
  const due = await db.raw<{ task_name: string; n: number | string }>(
    `SELECT task_name, COUNT(*) AS n FROM cron_configs
     WHERE is_enabled = ${db.driver === "sqlite" ? 1 : "TRUE"}
       AND (next_run_at IS NULL OR next_run_at <= ${placeholder(db.driver, 0)})
     GROUP BY task_name`,
    [now],
  );
  const dueByTask = new Map(due.map((row) => [String(row.task_name), Number(row.n)]));
  const tasks = [];
  for (const task of CRON_TASKS) {
    tasks.push({
      task,
      globallyEnabled: await settingFlag(cronGlobalKey(task)),
      dueProjects: dueByTask.get(task) ?? 0,
    });
  }
  return apiOk({ data: tasks });
});

const globalCronSchema = z.object({
  task: z.enum(CRON_TASKS),
  isEnabled: z.boolean(),
});

/** PUT /api/admin/cron — flip one task's global switch (§6.4 global cron). */
export const adminCronPut = handler(async (request) => {
  await requireOperator(request);
  const body = await parseJson(request, globalCronSchema);
  const db = getDb();
  const p = db.driver;
  const key = cronGlobalKey(body.task);
  const encoded = JSON.stringify(body.isEnabled);
  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM system_configs WHERE config_key = ${placeholder(p, 0)}`,
    [key],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE system_configs SET config_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
      [encoded, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)})`,
      [key, encoded],
    );
  }
  invalidateConfig(key);
  return apiOk({ success: true, task: body.task, isEnabled: body.isEnabled });
});

/**
 * Cron task registry (Blueprint §5.8).
 *
 * `BUILTIN_TASKS` is the documented five-task set; `CRON_TASKS` adds three
 * platform maintenance tasks that ship with the same toggle/run surface so the
 * console can operate everything through one API. Cadences mirror the
 * documented schedules (daily/weekly plus the platform maintenance intervals).
 */
import { nextCronRun, scheduleFromParameters } from "./cron-schedule";
export const BUILTIN_TASKS = [
  "clean_expired_sessions",
  "clean_old_logs",
  "generate_daily_stats",
  "send_daily_summary_webhook",
  "clean_orphaned_uploads",
] as const;

export const PLATFORM_TASKS = [
  "retry_failed_webhooks",
  "storage_audit",
  "heartbeat",
  "renew_ssl_certificates",
] as const;

export const CRON_TASKS = [...BUILTIN_TASKS, ...PLATFORM_TASKS] as const;

export type CronTask = (typeof CRON_TASKS)[number];

/** Fixed cadence per task, in minutes (§5.8 schedules approximated). */
export const TASK_INTERVAL_MINUTES: Record<CronTask, number> = {
  clean_expired_sessions: 24 * 60,
  clean_old_logs: 24 * 60,
  generate_daily_stats: 24 * 60,
  send_daily_summary_webhook: 24 * 60,
  clean_orphaned_uploads: 7 * 24 * 60,
  retry_failed_webhooks: 15,
  storage_audit: 24 * 60,
  heartbeat: 5,
  renew_ssl_certificates: 6 * 60,
};

/** Documented per-task parameters; persisted in `cron_configs.parameters`. */
export const DEFAULT_TASK_PARAMETERS: Record<CronTask, Record<string, unknown>> = {
  clean_expired_sessions: { retention_days: 7 },
  clean_old_logs: {},
  generate_daily_stats: {},
  send_daily_summary_webhook: { webhook_id: null },
  clean_orphaned_uploads: { max_age_hours: 24 },
  retry_failed_webhooks: {},
  storage_audit: {},
  heartbeat: {},
  renew_ssl_certificates: {},
};

/** Global enable/disable switch for one task (§5.8 admin control). */
export function cronGlobalKey(task: CronTask): string {
  return `cron.task.${task}.enabled`;
}

/**
 * Next scheduled run for a task. `floorMinutes` is the admin-configured
 * `cron.min_interval_minutes`, which never shortens a task's own cadence but
 * protects the runner from a corrupt/too-frequent `next_run_at`.
 *
 * A task's `parameters` may carry a real schedule (Tech docs §8): either a
 * 5-field `schedule` expression, which wins, or `every_minutes`, which
 * overrides the built-in cadence. `floorMinutes` is still applied to interval
 * schedules; an expression is honoured exactly as written, because rejecting a
 * user's explicit "every 5 minutes" expression would be worse than the
 * operator's floor.
 */
export function nextRunAtFor(
  task: CronTask,
  fromIso: string = new Date().toISOString(),
  floorMinutes = 0,
  parameters?: unknown,
): string {
  const { schedule, everyMinutes } = scheduleFromParameters(parameters);
  const from = new Date(fromIso);
  if (schedule) {
    const next = nextCronRun(schedule, from);
    return (next ?? new Date(from.getTime() + Math.max(TASK_INTERVAL_MINUTES[task], floorMinutes) * 60_000)).toISOString();
  }
  const minutes = Math.max(everyMinutes ?? TASK_INTERVAL_MINUTES[task], floorMinutes);
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

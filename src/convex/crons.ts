import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * The five built-in tasks from the specification run for every project; each
 * project's `cron_configs` row decides whether its run is executed or skipped.
 */
const crons = cronJobs();

crons.daily(
  "localme-generate-daily-stats",
  { hourUTC: 1, minuteUTC: 0 },
  internal.automation.runDailyTask,
  { taskName: "GenerateDailyStats" },
);

crons.daily(
  "localme-clean-expired-sessions",
  { hourUTC: 2, minuteUTC: 0 },
  internal.automation.runDailyTask,
  { taskName: "CleanExpiredSessions" },
);

crons.daily(
  "localme-clean-old-logs",
  { hourUTC: 3, minuteUTC: 0 },
  internal.automation.runDailyTask,
  { taskName: "CleanOldLogs" },
);

crons.daily(
  "localme-daily-summary-webhook",
  { hourUTC: 8, minuteUTC: 0 },
  internal.automation.runDailyTask,
  { taskName: "SendDailySummaryWebhook" },
);

crons.weekly(
  "localme-clean-orphaned-uploads",
  { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
  internal.automation.runDailyTask,
  { taskName: "CleanOrphanedUploads" },
);

crons.interval("localme-clean-rate-limits", { hours: 6 }, internal.maintenance.cleanRateLimits, {});
crons.interval("localme-clean-captchas", { minutes: 30 }, internal.maintenance.cleanCaptchas, {});

export default crons;

/**
 * /admin/api/global-cron — the path Blueprint §6.4 names for global cron task
 * management. Alias of /api/admin/cron; both call the same handlers.
 */
import { adminCronGet, adminCronPut } from "@/lib/server/admin-routes";

export const GET = adminCronGet;
export const PUT = adminCronPut;

/** /api/admin/cron — global cron task switches (§6.4). */
import { adminCronGet, adminCronPut } from "@/lib/server/admin-routes";

export const GET = adminCronGet;
export const PUT = adminCronPut;

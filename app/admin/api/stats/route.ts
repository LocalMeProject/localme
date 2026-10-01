/**
 * /admin/api/stats — the path Blueprint §6.4 names for aggregated platform
 * statistics. Alias of /api/admin (GET); both return the same counters.
 */
import { adminStats } from "@/lib/server/admin-routes";

export const GET = adminStats;

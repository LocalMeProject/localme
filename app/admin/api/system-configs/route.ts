/**
 * /admin/api/system-configs — the path Blueprint §6.4 names for system
 * configuration. Alias of /api/admin/config; both call the same handlers.
 */
import { adminConfigGet, adminConfigSet } from "@/lib/server/admin-routes";

export const GET = adminConfigGet;
export const PUT = adminConfigSet;

/**
 * /admin/api/projects — the path Blueprint §6.4 names for platform-wide project
 * management. Alias of /api/admin/projects; both call the same handlers.
 */
import { adminProjectsDelete, adminProjectsList, adminProjectsPatch } from "@/lib/server/admin-routes";

export const GET = adminProjectsList;
export const PATCH = adminProjectsPatch;
export const DELETE = adminProjectsDelete;
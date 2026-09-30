/** /api/roles — per-project roles for visitors (console-only management). */
import { consoleRolesCreate, consoleRolesList } from "@/lib/server/console-routes";

export const GET = consoleRolesList;
export const POST = consoleRolesCreate;

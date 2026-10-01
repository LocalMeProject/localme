/** /api/roles/[roleId] — update or delete one of a project's visitor roles. */
import { consoleRolesDelete, consoleRolesUpdate } from "@/lib/server/console-routes";

type Params = { params: Promise<{ roleId: string }> };

export const PATCH = async (request: Request, context: Params) => consoleRolesUpdate(request, context);

export const DELETE = async (request: Request, context: Params) => consoleRolesDelete(request, context);
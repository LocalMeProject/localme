/** /api/routes/{id} — delete one serving route (console-only). */
import { consoleRoutesDelete } from "@/lib/server/console-routes";

type Params = { params: Promise<{ routeId: string }> };

export const DELETE = async (request: Request, context: Params) => consoleRoutesDelete(request, context);

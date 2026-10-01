/** /api/visitors/{id} — update or delete one project visitor account. */
import { consoleVisitorsDelete, consoleVisitorsUpdate } from "@/lib/server/console-routes";

type Params = { params: Promise<{ visitorId: string }> };

export const PATCH = async (request: Request, context: Params) => consoleVisitorsUpdate(request, context);

export const DELETE = async (request: Request, context: Params) => consoleVisitorsDelete(request, context);

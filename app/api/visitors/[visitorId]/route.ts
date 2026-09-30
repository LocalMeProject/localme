/** /api/visitors/{id} — delete one visitor account (console-only). */
import { consoleVisitorsDelete } from "@/lib/server/console-routes";

type Params = { params: Promise<{ visitorId: string }> };

export const DELETE = async (request: Request, context: Params) => consoleVisitorsDelete(request, context);

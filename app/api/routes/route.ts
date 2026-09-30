/** /api/routes — serving-route configuration (console-only, owned projects). */
import { consoleRoutesCreate, consoleRoutesList } from "@/lib/server/console-routes";

export const GET = consoleRoutesList;
export const POST = consoleRoutesCreate;

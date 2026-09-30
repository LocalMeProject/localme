/** /api/visitors — per-project visitor accounts (console-only management). */
import { consoleVisitorsCreate, consoleVisitorsList } from "@/lib/server/console-routes";

export const GET = consoleVisitorsList;
export const POST = consoleVisitorsCreate;

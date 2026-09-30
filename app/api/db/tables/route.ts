/** GET /api/db/tables — document-store tables with row counts (console-only). */
import { consoleTablesList } from "@/lib/server/console-routes";

export const GET = consoleTablesList;

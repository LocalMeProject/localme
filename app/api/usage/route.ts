/** GET /api/usage — daily visit stats and quota snapshot for one project. */
import { consoleUsage } from "@/lib/server/console-routes";

export const GET = consoleUsage;

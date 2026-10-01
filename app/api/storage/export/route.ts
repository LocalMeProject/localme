/** GET /api/storage/export — the whole project as a ZIP archive (Blueprint §4.3). */
import { consoleStorageExport } from "@/lib/server/console-routes";

export const GET = consoleStorageExport;

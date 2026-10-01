/** GET /api/export/all?projectId=N — full-project ZIP export (§5.10). */
import { exportAllHandler } from "@/lib/server/export-routes";

export const GET = exportAllHandler;

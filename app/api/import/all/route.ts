/** POST /api/import/all?projectId=N — restore a full-project ZIP (§5.10). */
import { importAllHandler } from "@/lib/server/export-routes";

export const POST = importAllHandler;

/** POST /api/import/{feature}?projectId=N — JSON import, overwrites (§5.10). */
import { importFeatureHandler } from "@/lib/server/export-routes";

export const POST = importFeatureHandler;

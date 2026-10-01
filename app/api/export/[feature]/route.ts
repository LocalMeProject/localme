/** GET /api/export/{feature}?projectId=N — per-feature JSON export (§5.10). */
import { exportFeatureHandler } from "@/lib/server/export-routes";

export const GET = exportFeatureHandler;

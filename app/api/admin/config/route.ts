/** /api/admin/config — system configuration (is_admin sessions only). */
import { adminConfigSet, adminConfigTree } from "@/lib/server/admin-routes";

export const GET = adminConfigTree;
export const PUT = adminConfigSet;

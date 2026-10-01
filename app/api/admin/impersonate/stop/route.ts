/** POST /api/admin/impersonate/stop — restore the operator's own session. */
import { adminImpersonateStop } from "@/lib/server/admin-routes";

export const POST = adminImpersonateStop;
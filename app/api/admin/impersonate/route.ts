/**
 * /api/admin/impersonate — sign in as another console user, and report whether
 * the current session is an impersonation.
 *
 * POST { userId }  → swaps the session cookie for one owned by that account
 * GET              → { impersonatedBy } for the console banner
 *
 * The operator's own session id rides inside the impersonation session row, so
 * POST /api/admin/impersonate/stop hands control back.
 */
import { adminImpersonateStart, adminImpersonateStatus } from "@/lib/server/admin-routes";

export const GET = adminImpersonateStatus;
export const POST = adminImpersonateStart;
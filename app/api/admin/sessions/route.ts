/** DELETE /api/admin/sessions?userId=N — sign an account out of every session. */
import { adminSessionsRevoke } from "@/lib/server/admin-routes";

export const DELETE = adminSessionsRevoke;
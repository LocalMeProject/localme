/**
 * /api/admin/users — account administration (is_admin sessions only).
 *
 * GET                 → paginated, filtered account list
 * GET  ?userId=N      → one account with its projects and usage
 * PATCH               → suspend/resume/promote/unlock/re-cap one or many
 * DELETE              → remove an account (requires the username echoed back)
 */
import {
  adminUserDetail,
  adminUsersDelete,
  adminUsersList,
  adminUsersPatch,
} from "@/lib/server/admin-routes";
import { handler } from "@/lib/server/http";

export const GET = handler(async (request) => {
  const url = new URL(request.url);
  return url.searchParams.has("userId") ? adminUserDetail(request) : adminUsersList(request);
});

export const PATCH = adminUsersPatch;
export const DELETE = adminUsersDelete;
/**
 * /admin/api/users — the path Blueprint §6.4 names for user management. Alias
 * of /api/admin/users; both call the same handlers.
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
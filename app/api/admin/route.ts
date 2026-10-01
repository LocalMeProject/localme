/**
 * /api/admin — operator console API (is_admin sessions only).
 *
 * GET                      → platform stats
 * GET ?resource=config     → effective configuration (flat + §10 nested tree)
 * PUT                      → set one system config
 * PATCH                    → update a user
 * PATCH ?resource=config   → set one system config (alias)
 *
 * Sub-resources: /api/admin/users, /api/admin/config, /api/admin/projects,
 * /api/admin/cron, /api/admin/public-library.
 */
import { ApiError, handler } from "@/lib/server/http";
import {
  adminConfigSet,
  adminConfigTree,
  adminStats,
  adminUsersPatch,
} from "@/lib/server/admin-routes";

export const GET = handler(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("resource") === "config") {
    return adminConfigTree(request);
  }
  return adminStats(request);
});

export const PUT = adminConfigSet;

export const PATCH = handler(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("resource") === "config") {
    return adminConfigSet(request);
  }
  return adminUsersPatch(request);
});

/** Backwards-compatible read of the config via POST; anything else is a 405. */
export const POST = handler(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("resource") === "config") {
    return adminConfigTree(request);
  }
  throw new ApiError("method_not_allowed", "POST is only supported for ?resource=config.");
});

/**
 * User-centered Master API Key management (reveal & regenerate).
 *
 * GET  /api/account/key — retrieve the user's master key (decrypted for reveal)
 * POST /api/account/key — regenerate the user's master key
 */
import { apiOk, handler } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { getUserMasterApiKey, regenerateUserMasterApiKey, createMasterApiKey } from "@/lib/server/repos";

export const GET = handler(async (request) => {
  const principal = await requireSessionUser(request);
  let master = await getUserMasterApiKey(principal.userId!);
  if (!master) {
    master = await createMasterApiKey(principal.userId!, "Master Key");
  }
  return apiOk({
    id: master.record.id,
    prefix: master.record.prefix,
    name: master.record.name,
    key: master.key,
    createdAt: master.record.createdAt,
    lastUsedAt: master.record.lastUsedAt,
  });
});

export const POST = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const regenerated = await regenerateUserMasterApiKey(principal.userId!);
  return apiOk({
    id: regenerated.record.id,
    prefix: regenerated.record.prefix,
    name: regenerated.record.name,
    key: regenerated.key,
    createdAt: regenerated.record.createdAt,
  });
});

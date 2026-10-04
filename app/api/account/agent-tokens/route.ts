import { handler, apiOk, ApiError } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { listActiveAats, revokeAat } from "@/lib/server/tokens";

export const GET = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const aats = await listActiveAats(principal.userId!);
  return apiOk(aats);
});

export const DELETE = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError("bad_request", "Valid token id is required.");
  }

  await revokeAat(principal.userId!, id, clientIp);
  return apiOk({ revoked: true });
});

import { handler, apiOk, ApiError, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import {
  getConsentRequest,
  approveConsentRequest,
  denyConsentRequest,
} from "@/lib/server/tokens";
import { z } from "zod";

export const GET = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId");
  if (!requestId) {
    throw new ApiError("bad_request", "requestId query parameter is required.");
  }
  const consent = await getConsentRequest(requestId);
  if (consent.userId !== principal.userId) {
    throw new ApiError("forbidden", "You cannot view a consent request for another user.");
  }
  return apiOk(consent);
});

const actionSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "deny"]),
  duration: z.enum(["4h", "1d"]).optional(),
});

export const POST = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const body = await parseJson(req, actionSchema);

  if (body.action === "approve") {
    await approveConsentRequest(principal.userId!, body.requestId, {
      duration: body.duration,
      ipAddress: clientIp,
    });
    return apiOk({ approved: true });
  } else {
    await denyConsentRequest(principal.userId!, body.requestId, clientIp);
    return apiOk({ denied: true });
  }
});

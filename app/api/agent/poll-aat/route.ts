import { handler, apiOk, ApiError } from "@/lib/server/http";
import { pollConsentRequest, checkAgentRequestRateLimit } from "@/lib/server/tokens";

export const GET = handler(async (req) => {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  checkAgentRequestRateLimit(`agent_poll:${clientIp}`, 120, 60_000);
  const url = new URL(req.url);
  const requestId = url.searchParams.get("requestId");
  if (!requestId) {
    throw new ApiError("bad_request", "requestId query parameter is required.");
  }
  const result = await pollConsentRequest(requestId);
  return apiOk(result);
});

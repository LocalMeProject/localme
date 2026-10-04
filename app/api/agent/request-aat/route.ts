import { handler, apiOk, parseJson } from "@/lib/server/http";
import { requestAat, checkAgentRequestRateLimit } from "@/lib/server/tokens";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(1),
  clientName: z.string().min(1).max(128),
  tokenName: z.string().min(1).max(128),
  description: z.string().max(500).optional().nullable(),
  requestedDuration: z.enum(["4h", "1d"]).optional(),
});

export const POST = handler(async (req) => {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  checkAgentRequestRateLimit(`agent_req:${clientIp}`);
  const body = await parseJson(req, schema);
  const result = await requestAat({
    ...body,
    ipAddress: clientIp,
  });
  return apiOk(result, { status: 201 });
});

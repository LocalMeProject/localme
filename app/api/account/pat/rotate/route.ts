import { handler, apiOk, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { rotatePat } from "@/lib/server/tokens";
import { z } from "zod";

const rotateSchema = z.object({
  id: z.number().int().positive(),
});

export const POST = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const body = await parseJson(req, rotateSchema);

  const result = await rotatePat(principal.userId!, body.id, {
    isManual: true,
    ipAddress: clientIp,
  });

  return apiOk(result);
});

import { handler, apiOk, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { revealPat } from "@/lib/server/tokens";
import { z } from "zod";

const revealSchema = z.object({
  id: z.number().int().positive(),
});

export const POST = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const body = await parseJson(req, revealSchema);

  const result = await revealPat(principal.userId!, body.id, clientIp);
  return apiOk(result);
});

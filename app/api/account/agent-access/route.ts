import { handler, apiOk, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { setAgentAccessPreference } from "@/lib/server/tokens";
import { z } from "zod";

const toggleSchema = z.object({
  allow: z.boolean(),
});

export const PATCH = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const body = await parseJson(req, toggleSchema);
  const allowed = await setAgentAccessPreference(principal.userId!, body.allow);
  return apiOk({ allowAgentRequests: allowed });
});

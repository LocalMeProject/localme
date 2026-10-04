import { handler, apiOk } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { listTokenAuditLogs } from "@/lib/server/tokens";

export const GET = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const logs = await listTokenAuditLogs(principal.userId!);
  return apiOk(logs);
});

/**
 * POST /api/domains/renew — re-issue certificates inside the renewal window
 * (Blueprint §5.6 step 7: "SSL certificate auto-renews 30 days before expiry").
 *
 * The same work runs unattended from the platform cron sweep; this endpoint
 * exists so an operator (or a support flow) can force it now.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePermission, requireSessionUser } from "@/lib/server/api-auth";
import { requireOwnedProject } from "@/lib/server/repos";
import { renewExpiringCertificates } from "@/lib/server/ssl";

const renewSchema = z.object({ email: z.string().email().max(254).optional() });

export const POST = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  requirePermission(principal, "domains_manage");
  await requireOwnedProject(principal.userId!, projectId);
  const body = await parseJson(request, renewSchema);
  const result = await renewExpiringCertificates({ email: body.email });
  return apiOk({ success: true, ...result });
});

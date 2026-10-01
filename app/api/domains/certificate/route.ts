/**
 * Certificate endpoints for custom domains (Blueprint §5.6).
 *
 *   GET  /api/domains/certificate?projectId=N            — certificate status
 *   POST /api/domains/certificate?projectId=N&domain=…  — issue one now
 *
 * Provisioning needs `ssl.auto_provision`; when it is off these endpoints
 * report the state and refuse to order, because reaching out to an ACME
 * provider is an operator decision, not a default.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePermission, requireSessionUser } from "@/lib/server/api-auth";
import { hasValidCertificate, provisionCertificate, sslStatus } from "@/lib/server/ssl";
import { requireOwnedProject } from "@/lib/server/repos";

const requestSchema = z.object({
  email: z.string().email().max(254),
  sans: z.array(z.string().max(253)).max(20).optional(),
});

async function ownedProject(request: Request) {
  const principal = await requireSessionUser(request);
  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  requirePermission(principal, "domains_manage");
  return requireOwnedProject(principal.userId!, projectId);
}

export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  const status = await sslStatus();
  if (!domain) return apiOk(status);
  return apiOk({ ...status, domain, hasCertificate: await hasValidCertificate(domain) });
});

export const POST = handler(async (request) => {
  // Authorizes before ordering a certificate: the caller must own the project.
  await ownedProject(request);
  const url = new URL(request.url);
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!domain) throw new ApiError("bad_request", "domain query parameter is required.");
  const body = await parseJson(request, requestSchema);
  const certificate = await provisionCertificate(domain, { email: body.email, sans: body.sans });
  return apiOk({ success: true, domain: certificate.domain, expiresAt: certificate.expiresAt });
});

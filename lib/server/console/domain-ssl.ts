import { z } from "zod";
import { randomBytes } from "node:crypto";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { createLogger } from "@/lib/server/logger";
import { provisionCertificate, renewExpiringCertificates, sslStatus } from "@/lib/server/ssl";
import { scopedProject, toBool } from "./common";

export const certificateSchema = z.object({
  email: z.string().email().max(254),
  sans: z.array(z.string().max(253)).max(20).optional(),
});

export const consoleDomainsList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, domain, verification_token, is_verified, ssl_certificate, ssl_expires_at, created_at
     FROM domains WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id`,
    [project.id],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      domain: String(row.domain),
      verificationToken: String(row.verification_token),
      isVerified: toBool(row.is_verified),
      hasCertificate: Boolean(row.ssl_certificate),
      certificateExpiresAt: (row.ssl_expires_at as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
    ssl: await sslStatus(),
  });
});

export const consoleDomainCertificate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"), "domains_manage");
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!domain) throw new ApiError("bad_request", "domain query parameter is required.");
  const body = await parseJson(request, certificateSchema);
  const certificate = await provisionCertificate(domain, { email: body.email, sans: body.sans });
  logDomainEvent("certificate_issued", { projectId: project.id, domain });
  return apiOk({
    success: true,
    domain: certificate.domain,
    expiresAt: certificate.expiresAt,
  });
});

export const consoleDomainsRenew = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"), "domains_manage");
  const body = await parseJson(request, certificateSchema.partial());
  const result = await renewExpiringCertificates({ email: body.email });
  logDomainEvent("certificates_renewed", { projectId: project.id, renewed: result.renewed });
  return apiOk({ success: true, ...result });
});

function logDomainEvent(message: string, fields: Record<string, unknown>): void {
  createLogger("domains").info(message, fields);
}

export const domainCreateSchema = z.object({
  domain: z
    .string()
    .max(253)
    .regex(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i),
});

export const consoleDomainsCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, domainCreateSchema);
  const domain = body.domain.trim().toLowerCase();
  const db = getDb();
  const verificationToken = `localme-verify=${randomBytes(16).toString("hex")}`;
  try {
    await db.run(
      `INSERT INTO domains (project_id, domain, verification_token) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, ${placeholder(db.driver, 2)})`,
      [project.id, domain, verificationToken],
    );
  } catch (error) {
    if (/UNIQUE constraint failed|duplicate key value/i.test(error instanceof Error ? error.message : String(error))) {
      throw new ApiError("conflict", "That domain is already attached.");
    }
    throw error;
  }
  return apiOk(
    {
      success: true,
      domain,
      verificationToken,
      dns: { name: `_localme-verify.${domain}`, type: "TXT", value: verificationToken },
    },
    { status: 201 },
  );
});

export const consoleDomainsVerify = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const domain = (url.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!domain) throw new ApiError("bad_request", "domain query parameter is required.");
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, verification_token, is_verified FROM domains
     WHERE project_id = ${placeholder(db.driver, 0)} AND domain = ${placeholder(db.driver, 1)}`,
    [project.id, domain],
  );
  const row = rows[0];
  if (!row) throw new ApiError("not_found", "Domain not attached to this project.");
  if (toBool(row.is_verified)) {
    return apiOk({ success: true, verified: true, domain });
  }

  let txtValues: string[] = [];
  try {
    const dnsResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_localme-verify.${encodeURIComponent(domain)}&type=TXT`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(8_000) },
    );
    const dnsJson = (await dnsResponse.json()) as { Answer?: Array<{ type: number; data: string }> };
    txtValues = (dnsJson.Answer ?? [])
      .filter((answer) => answer.type === 16)
      .map((answer) => answer.data.replace(/^"|"$/g, ""));
  } catch {
    // DNS lookup failure means "not verified yet"
  }

  const verified = txtValues.includes(String(row.verification_token));
  if (verified) {
    await db.run(
      `UPDATE domains SET is_verified = ${placeholder(db.driver, 0)}, updated_at = ${placeholder(db.driver, 1)} WHERE id = ${placeholder(db.driver, 2)}`,
      [db.driver === "sqlite" ? 1 : true, new Date().toISOString(), Number(row.id)],
    );
  }
  return apiOk({ success: true, verified, domain, dnsRecordsFound: txtValues.length });
});

export const consoleDomainsDelete = handler(async (request, context) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const domainId = Number((await context.params).domainId);
  if (!Number.isInteger(domainId) || domainId <= 0) {
    throw new ApiError("bad_request", "Invalid domain id.");
  }
  const db = getDb();
  const result = await db.run(
    `DELETE FROM domains WHERE id = ${placeholder(db.driver, 0)} AND project_id = ${placeholder(db.driver, 1)}`,
    [domainId, project.id],
  );
  if (result.changes === 0) throw new ApiError("not_found", "Domain not found.");
  return apiOk({ success: true });
});

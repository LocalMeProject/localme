import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { verificationToken } from "./lib/crypto";
import { fail } from "./lib/errors";
import { audit, requireProjectOwnership, requireProjectOwnershipMutation } from "./lib/session";
import { validateDomain } from "./lib/validation";

export const VERIFICATION_PREFIX = "_mvp-verify";

export const list = query({
  args: { token: v.optional(v.string()), projectId: v.id("projects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectOwnership(ctx, args.token, args.projectId);
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return domains
      .map((domain) => ({
        id: domain._id,
        domain: domain.domain,
        verificationToken: domain.verificationToken,
        txtRecordName: `${VERIFICATION_PREFIX}.${domain.domain}`,
        isVerified: domain.isVerified,
        sslStatus: domain.sslStatus,
        sslExpiresAt: domain.sslExpiresAt ?? null,
        verifiedAt: domain.verifiedAt ?? null,
        verificationMessage: domain.verificationMessage ?? null,
        createdAt: domain.createdAt,
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
  },
});

export const add = mutation({
  args: { token: v.string(), projectId: v.id("projects"), domain: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const domain = validateDomain(args.domain);
    const existing = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (existing) fail("That domain is already registered", 409, "domain_exists");
    const token = verificationToken();
    const now = Date.now();
    const id = await ctx.db.insert("domains", {
      projectId: project._id,
      domain,
      verificationToken: token,
      isVerified: false,
      sslStatus: "none",
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, {
      level: "info",
      event: "domain.added",
      message: `Domain ${domain} registered`,
      projectId: project._id,
      userId: user._id,
    });
    return { id, domain, verificationToken: token, txtRecordName: `${VERIFICATION_PREFIX}.${domain}` };
  },
});

export const remove = mutation({
  args: { token: v.string(), projectId: v.id("projects"), domainId: v.id("domains") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnershipMutation(ctx, args.token, args.projectId);
    const row = await ctx.db.get(args.domainId);
    if (!row || row.projectId !== project._id) return null;
    await ctx.db.delete(row._id);
    return null;
  },
});

/**
 * Checks the deployed DNS TXT record through a DNS-over-HTTPS resolver, then
 * marks the domain verified. Records the outcome either way so the dashboard
 * can explain what is missing.
 */
export const verify = action({
  args: { token: v.string(), projectId: v.id("projects"), domainId: v.id("domains") },
  returns: v.any(),
  handler: async (ctx, args): Promise<{ verified: boolean; message: string; recordName: string }> => {
    const record = (await ctx.runQuery(internal.domains.pendingVerification, {
      token: args.token,
      projectId: args.projectId,
      domainId: args.domainId,
    })) as { domain: string; verificationToken: string };
    const name = `${VERIFICATION_PREFIX}.${record.domain}`;
    let found: string[] = [];
    let message = "";
    try {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
        headers: { accept: "application/dns-json" },
      });
      if (!response.ok) {
        message = `DNS lookup failed with status ${response.status}`;
      } else {
        const body = (await response.json()) as { Answer?: { data?: string }[] };
        found = (body.Answer ?? []).map((answer) => (answer.data ?? "").replace(/"/g, "").trim());
        if (!found.some((value) => value.includes(record.verificationToken))) {
          message = `No TXT record at ${name} containing ${record.verificationToken}`;
        }
      }
    } catch (error) {
      message = `DNS lookup error: ${error instanceof Error ? error.message : String(error)}`;
    }
    const verified = found.some((value) => value.includes(record.verificationToken));
    await ctx.runMutation(internal.domains.applyVerification, {
      domainId: args.domainId,
      verified,
      message: verified ? "Verification succeeded" : message,
    });
    return { verified, message: verified ? "Verification succeeded" : message, recordName: name };
  },
});

export const pendingVerification = internalQuery({
  args: { token: v.optional(v.string()), projectId: v.id("projects"), domainId: v.id("domains") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwnership(ctx, args.token, args.projectId);
    const row = await ctx.db.get(args.domainId);
    if (!row || row.projectId !== project._id) fail("Domain not found", 404, "not_found");
    return { domain: row.domain, verificationToken: row.verificationToken };
  },
});

export const applyVerification = internalMutation({
  args: { domainId: v.id("domains"), verified: v.boolean(), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.domainId);
    if (!row) return null;
    await ctx.db.patch(row._id, {
      isVerified: args.verified,
      verifiedAt: args.verified ? Date.now() : undefined,
      verificationMessage: args.message,
      // Certificate issuance is handled by the hosting layer once DNS resolves.
      sslStatus: args.verified ? "pending" : "none",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Marks a verified domain's certificate as active (hosting hook). */
export const markSslActive = internalMutation({
  args: { domainId: v.id("domains"), expiresAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.domainId);
    if (!row) return null;
    await ctx.db.patch(row._id, {
      sslStatus: "active",
      sslExpiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
    return null;
  },
});

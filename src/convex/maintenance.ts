import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { readConfig } from "./lib/config";
import { checkRateLimit } from "./lib/session";

/** One-hop wrapper so the HTTP layer can consume a rate-limit slot. */
export const consumeRateLimit = internalMutation({
  args: {
    identity: v.string(),
    routePattern: v.string(),
    limit: v.number(),
    windowMs: v.optional(v.number()),
    cost: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await checkRateLimit(ctx, args);
  },
});

/** Removes rate-limit counters older than the configured retention window. */
export const cleanRateLimits = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const retention = await readConfig<{ rate_limit_retention_days: number }>(ctx, "retention");
    const cutoff = Date.now() - retention.rate_limit_retention_days * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("rateLimits")
      .withIndex("by_window", (q) => q.lt("windowStart", cutoff))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/** Platform-wide session sweep, using the project retention default. */
export const cleanExpiredSessions = internalMutation({
  args: { retentionDays: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.retentionDays ?? 7) * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("sessions")
      .withIndex("by_expires", (q) => q.lt("expiresAt", cutoff))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/** Discards CAPTCHA challenges that were never solved. */
export const cleanCaptchas = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("captchas").collect();
    const stale = rows.filter((row) => row.expiresAt < Date.now());
    for (const row of stale) await ctx.db.delete(row._id);
    return stale.length;
  },
});

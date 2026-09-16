import type { MutationCtx, QueryCtx } from "../_generated/server";
import { randomToken } from "./crypto";

/**
 * Default system configuration (Blueprint §10). Every value is database-backed
 * (P-29); these literals are only the initial seed and the fallback for keys an
 * administrator has not created yet.
 */
export const DEFAULT_CONFIGS: { key: string; value: unknown; description: string }[] = [
  {
    key: "storage",
    description: "Storage quotas and upload limits",
    value: {
      default_user_cap_bytes: 5_242_880,
      max_user_cap_bytes: 1_073_741_824,
      library_bonus_bytes: 5_242_880,
      max_upload_size_bytes: 10_485_760,
    },
  },
  {
    key: "visits",
    description: "Visit counting and deduplication",
    value: { free_visits_per_month: 100, dedupe_window_seconds: 300 },
  },
  {
    key: "rate_limits",
    description: "Sliding-window rate limits per minute",
    value: {
      public_requests_per_minute: 60,
      authenticated_requests_per_minute: 300,
      admin_requests_per_minute: 600,
      api_key_requests_per_minute: 600,
      asset_requests_per_minute: 1000,
      library_requests_per_minute: 1000,
      ip_fallback_requests_per_minute: 30,
    },
  },
  {
    key: "auth",
    description: "Login lockout, session and API key lifetimes",
    value: {
      max_login_attempts: 5,
      lockout_minutes: 5,
      session_timeout_minutes: 20,
      api_key_expiry_days: 90,
    },
  },
  {
    key: "cron",
    description: "Scheduler limits",
    value: { max_concurrent_jobs: 5, timeout_seconds: 60, min_interval_minutes: 30 },
  },
  {
    key: "webhooks",
    description: "Webhook delivery limits",
    value: { rate_limit_per_minute: 100, max_webhooks_per_project: 20, timeout_seconds: 30 },
  },
  {
    key: "retention",
    description: "Log retention windows",
    value: {
      free_log_retention_months: 3,
      paid_log_retention_months: 24,
      rate_limit_retention_days: 7,
    },
  },
  {
    key: "proxy",
    description: "Reverse proxy timeouts",
    value: { default_timeout_seconds: 30, max_timeout_seconds: 60 },
  },
  {
    key: "platform",
    description: "Platform identity used in served pages and links",
    value: {
      name: "LocalMe",
      support_email: "support@localme.com",
      allow_public_signup: true,
      console_url: "",
      watermark_text: "Hosted on LocalMe",
      watermark_url: "https://localme.com",
    },
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function defaultConfigValue(key: string): unknown {
  const entry = DEFAULT_CONFIGS.find((candidate) => candidate.key === key);
  return entry ? clone(entry.value) : undefined;
}

/** Reads a configuration document, falling back to the seeded default. */
export async function readConfig<T extends Record<string, unknown>>(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<T> {
  const row = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("configKey", key))
    .unique();
  const stored = (row?.configValue as T | undefined) ?? undefined;
  const fallback = (defaultConfigValue(key) as T | undefined) ?? ({} as T);
  if (!stored) return fallback;
  return { ...fallback, ...stored };
}

/** Seeds any missing configuration documents (idempotent). */
export async function ensureConfigs(ctx: MutationCtx): Promise<void> {
  for (const entry of DEFAULT_CONFIGS) {
    const existing = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", entry.key))
      .unique();
    if (!existing) {
      await ctx.db.insert("systemConfigs", {
        configKey: entry.key,
        configValue: entry.value,
        description: entry.description,
        updatedAt: Date.now(),
      });
    }
  }
}

const MASTER_KEY_CONFIG = "platform_master_key";

/**
 * Returns the platform AES-256 master key, creating it on first use. Only the
 * keyed HMAC derivation of this value ever protects stored secrets, and the key
 * itself never leaves the deployment (P-11).
 */
export async function ensureMasterKey(ctx: MutationCtx): Promise<string> {
  const existing = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("configKey", MASTER_KEY_CONFIG))
    .unique();
  if (existing) return (existing.configValue as { key: string }).key;
  const key = randomToken(32);
  await ctx.db.insert("systemConfigs", {
    configKey: MASTER_KEY_CONFIG,
    configValue: { key },
    description: "Platform master key for AES-256-GCM secret encryption",
    updatedAt: Date.now(),
  });
  return key;
}

export async function readMasterKey(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const existing = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("configKey", MASTER_KEY_CONFIG))
    .unique();
  if (!existing) return null;
  return (existing.configValue as { key: string }).key;
}

/** Deterministic secret used to sign visitor JWTs and session material. */
export async function ensureSigningSecret(ctx: MutationCtx): Promise<string> {
  const existing = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("configKey", "platform_signing_secret"))
    .unique();
  if (existing) return (existing.configValue as { secret: string }).secret;
  const secret = randomToken(32);
  await ctx.db.insert("systemConfigs", {
    configKey: "platform_signing_secret",
    configValue: { secret },
    description: "Platform signing secret for session and visitor tokens",
    updatedAt: Date.now(),
  });
  return secret;
}

export async function readSigningSecret(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const existing = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("configKey", "platform_signing_secret"))
    .unique();
  if (!existing) return null;
  return (existing.configValue as { secret: string }).secret;
}

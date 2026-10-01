/**
 * Platform system configuration (Blueprint §10 system_configs).
 *
 * The Blueprint specifies one nested JSON tree; we store it flat with dotted
 * keys (`auth.lockout_minutes`) because the `system_configs` table is key/value
 * and the admin console edits one key at a time. `SYSTEM_CONFIG_TREE` renders
 * the flat keys back into the documented nested shape for the API/UI.
 *
 * Values are cached briefly so the serving hot path does not add a query per
 * request; every reader fails safe to the documented default.
 */
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";

export const SYSTEM_CONFIG_DEFAULTS: Record<string, number | string | boolean> = {
  // storage (§10.storage)
  // Project files across all of a user's projects.
  "storage.default_user_cap_bytes": 2_097_152,
  "storage.max_user_cap_bytes": 1_073_741_824,
  // Shared library assets, as an absolute ceiling of their own rather than a
  // bonus on the project cap — see assertStorageCap and libraryUsage.
  "storage.library_cap_bytes": 3_145_728,
  "storage.max_upload_size_bytes": 10_485_760,
  // §8.3 minification on save for HTML/CSS/JS; ?minify=0 opts a single upload out.
  "storage.minify_on_save": true,
  // visits (§10.visits)
  "visits.free_visits_per_month": 100,
  "visits.dedupe_window_seconds": 300,
  // rate_limits (§10.rate_limits)
  "rate_limits.public_requests_per_minute": 60,
  "rate_limits.authenticated_requests_per_minute": 300,
  "rate_limits.admin_requests_per_minute": 600,
  "rate_limits.api_key_requests_per_minute": 600,
  "rate_limits.asset_requests_per_minute": 1000,
  "rate_limits.library_requests_per_minute": 1000,
  "rate_limits.ip_fallback_requests_per_minute": 30,
  // Credential endpoints (login, signup, captcha, logout). Sized to outlast a
  // full lockout sequence — see GROUP_TIER_KEY in lib/server/ratelimit.ts.
  "rate_limits.auth_requests_per_minute": 30,
  // auth (§10.auth)
  "auth.max_login_attempts": 5,
  "auth.lockout_minutes": 5,
  "auth.session_timeout_minutes": 20,
  "auth.api_key_expiry_days": 90,
  // cron (§10.cron)
  "cron.max_concurrent_jobs": 5,
  "cron.timeout_seconds": 60,
  "cron.min_interval_minutes": 30,
  // webhooks (§10.webhooks)
  "webhooks.rate_limit_per_minute": 100,
  "webhooks.max_webhooks_per_project": 20,
  "webhooks.timeout_seconds": 30,
  // §5.9 says "Retry: No retries (as per requirement)", so retries are opt-in:
  // the outbox parks failures until an operator turns this on.
  "webhooks.retry_failed": false,
  "webhooks.max_attempts": 5,
  "webhooks.retry_backoff_seconds": 60,
  // Server-side fetch targets are validated: public http/https only, so a
  // tenant cannot use a webhook to reach the host's private network or a cloud
  // metadata endpoint. Self-hosted deployments that genuinely need a LAN target
  // can turn this on.
  "webhooks.allow_private_targets": false,
  // retention (§10.retention)
  "retention.free_log_retention_months": 3,
  // §10 also lists retention.paid_log_retention_months. There is no paid tier
  // to apply it to (no tier column, no billing), so the key is deliberately not
  // registered: an admin-editable switch that nothing reads is worse than an
  // absent one, because it looks like it works. Add it back with the tier.
  "retention.rate_limit_retention_days": 7,
  // proxy (§10.proxy)
  "proxy.default_timeout_seconds": 30,
  "proxy.max_timeout_seconds": 60,
  // serving (§7.8 anti-CDN hotlink validation; §7.7 is cross-project isolation).
  // On by default; an operator whose projects legitimately embed assets
  // cross-origin can turn it off.
  "serving.hotlink_protection": true,
  // Blueprint §14 pins the watermark markup to "MVP Platform" / mvp.com. The
  // position, styling and non-editable property are exactly as specified; the
  // label and link are operator config so a deployment is not advertising
  // another product. Empty values keep the §14 default.
  "watermark.label": "",
  "watermark.url": "",
  // logging (§9.4: no external agents; stdout by default, file sink optional)
  "logging.level": "info",
  "logging.sink": "stdout",
  "logging.file_path": "",
  // Custom-domain certificates (§5.6). Provisioning is opt-in: it needs a
  // reachable public domain, an ACME contact and an edge to install the PEM.
  "ssl.auto_provision": false,
  "ssl.acme_staging": true,
  "ssl.acme_directory_url": "",
  "ssl.acme_contact_email": "",
  "ssl.renewal_days_before_expiry": 30,
  // Global per-task enable switches used by the platform cron runner (§5.8).
  "cron.task.clean_expired_sessions.enabled": true,
  "cron.task.clean_old_logs.enabled": true,
  "cron.task.generate_daily_stats.enabled": true,
  "cron.task.send_daily_summary_webhook.enabled": true,
  "cron.task.clean_orphaned_uploads.enabled": true,
  "cron.task.retry_failed_webhooks.enabled": true,
  "cron.task.storage_audit.enabled": true,
  "cron.task.heartbeat.enabled": true,
  "cron.task.renew_ssl_certificates.enabled": true,
};

/** Set of config keys that are per-task global cron switches. */
export const CRON_GLOBAL_PREFIX = "cron.task.";
export const CRON_GLOBAL_SUFFIX = ".enabled";

/** Fold flat dotted keys back into the documented nested tree (§10). */
export function configTree(
  effective: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const tree: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(effective)) {
    const dot = key.indexOf(".");
    if (dot <= 0) continue;
    const group = key.slice(0, dot);
    const leaf = key.slice(dot + 1);
    tree[group] ??= {};
    tree[group]![leaf] = value;
  }
  return tree;
}

type CacheEntry = { value: unknown; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

function isCacheFresh(entry: CacheEntry | undefined): entry is CacheEntry & { value: unknown } {
  return Boolean(entry && entry.expiresAt > Date.now());
}

export async function configValue<T = number | string | boolean>(
  key: string,
): Promise<T | undefined> {
  const cached = cache.get(key);
  if (isCacheFresh(cached)) return cached.value as T;
  try {
    const db = getDb();
    const rows = await db.raw<{ config_value: string }>(
      `SELECT config_value FROM system_configs WHERE config_key = ${placeholder(db.driver, 0)} LIMIT 1`,
      [key],
    );
    if (!rows[0]) return undefined;
    const raw = rows[0].config_value;
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      // Store plain strings unquoted.
    }
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value as T;
  } catch {
    // Table missing (pre-migration) — defaults keep the platform running.
    return undefined;
  }
}

export async function configNumber(key: string, fallback: number): Promise<number> {
  const value = await configValue(key);
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Read a config number by key, defaulting to the documented value. */
export async function setting(key: string): Promise<number> {
  return configNumber(key, Number(SYSTEM_CONFIG_DEFAULTS[key] ?? 0));
}

/** Read a config boolean by key, defaulting to the documented value. */
export async function settingFlag(key: string): Promise<boolean> {
  const value = await configValue(key);
  if (value === undefined) return SYSTEM_CONFIG_DEFAULTS[key] === true;
  return value === true || value === "true" || value === 1;
}

/** All effective settings (defaults overlaid with stored overrides). */
export async function configAll(): Promise<Record<string, unknown>> {
  const effective: Record<string, unknown> = { ...SYSTEM_CONFIG_DEFAULTS };
  try {
    const db = getDb();
    const rows = await db.raw<{ config_key: string; config_value: string }>(
      `SELECT config_key, config_value FROM system_configs`,
    );
    for (const row of rows) {
      try {
        effective[row.config_key] = JSON.parse(row.config_value);
      } catch {
        effective[row.config_key] = row.config_value;
      }
    }
  } catch {
    // Defaults only.
  }
  return effective;
}

export function invalidateConfig(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

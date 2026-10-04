/**
 * Subscription plans configuration and cache (Blueprint §10 system_configs).
 *
 * Manages the three platform tiers: Free, Plus, and Pro.
 * Superadmin configures pricing and limits via the console; plans are cached
 * in memory with automatic invalidation on updates.
 */
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { configValue, invalidateConfig } from "@/lib/server/system-config";
import {
  type SubscriptionPlan,
  DEFAULT_PLANS,
} from "@/lib/subscriptions-shared";

export { type SubscriptionPlan, DEFAULT_PLANS };

const CONFIG_KEY = "subscription.plans";

let memoryPlansCache: { plans: SubscriptionPlan[]; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export function invalidateSubscriptionPlansCache(): void {
  memoryPlansCache = null;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  if (memoryPlansCache && Date.now() - memoryPlansCache.cachedAt < CACHE_TTL_MS) {
    return memoryPlansCache.plans;
  }

  const raw = await configValue<string | SubscriptionPlan[]>(CONFIG_KEY);
  if (!raw) {
    memoryPlansCache = { plans: DEFAULT_PLANS, cachedAt: Date.now() };
    return DEFAULT_PLANS;
  }

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryPlansCache = { plans: parsed as SubscriptionPlan[], cachedAt: Date.now() };
      return parsed as SubscriptionPlan[];
    }
  } catch {
    // Malformed JSON fallback
  }

  memoryPlansCache = { plans: DEFAULT_PLANS, cachedAt: Date.now() };
  return DEFAULT_PLANS;
}

export async function saveSubscriptionPlans(plans: SubscriptionPlan[]): Promise<void> {
  const db = getDb();
  const p = db.driver;
  const jsonStr = JSON.stringify(plans);

  // Check if row exists in system_configs
  const exists = await db.raw<{ config_key: string }>(
    `SELECT config_key FROM system_configs WHERE config_key = ${placeholder(p, 0)}`,
    [CONFIG_KEY],
  );

  if (exists[0]) {
    await db.run(
      `UPDATE system_configs SET config_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE config_key = ${placeholder(p, 2)}`,
      [jsonStr, new Date().toISOString(), CONFIG_KEY],
    );
  } else {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value, description) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
      [CONFIG_KEY, jsonStr, "Tier definitions for Free, Plus, and Pro plans"],
    );
  }

  memoryPlansCache = null;
  invalidateConfig(CONFIG_KEY);
}

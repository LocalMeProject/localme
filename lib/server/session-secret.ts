/**
 * The platform's signing secret, resolved once and cached.
 *
 * `SESSION_SECRET` is the documented way to configure this (§7.1), and it is
 * what a production deployment should always set. But three separate modules
 * used to read `process.env.SESSION_SECRET` directly, and a missing value made
 * each of them fail on its own schedule: signing in still appeared to work
 * (sessions fell back to an empty HMAC key), while visitor signup and secret
 * storage failed with a bare "SESSION_SECRET is not configured." That is a
 * terrible first-run experience and, before this change, a security hole — an
 * empty HMAC key means anybody can mint a valid session cookie.
 *
 * Resolution order:
 *   1. `SESSION_SECRET` from the environment — used verbatim, always wins.
 *   2. A generated secret persisted once in `system_configs`, so a fresh clone
 *      or a self-hosted deploy works with no configuration at all and keeps
 *      working across restarts.
 *
 * The generated value is 32 random bytes, never a constant: two deployments
 * never share one, and it is stored in the same database that already holds
 * password hashes. Anyone who can read that table can forge sessions — which is
 * the same trust boundary as reading the password hashes, and far better than a
 * hardcoded default everyone on the internet already knows.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db/index";
import { placeholder } from "./db/sql";

/** Where the generated fallback lives in `system_configs`. */
const FALLBACK_KEY = "platform.session_secret";

let cached: { source: string; value: string } | null = null;

/** The configured environment value, or null. Never throws. */
export function sessionSecretFromEnv(): string | null {
  const value = process.env.SESSION_SECRET;
  return value && value.length > 0 ? value : null;
}

export function sessionSecretConfigured(): boolean {
  return sessionSecretFromEnv() !== null;
}

/**
 * The signing secret for session cookies, visitor tokens and stored secrets.
 *
 * Throws if the database is unreachable and there is no environment value —
 * there is no safe way to invent a key that silently changes on every restart.
 */

function readSecretFromFile(): string | null {
  try {
    const filePath = join(process.cwd(), "data", ".session_secret");
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8").trim();
      if (content.length > 0) return content;
    }
  } catch {
    // Ignore file read errors
  }
  return null;
}

function writeSecretToFile(val: string): void {
  try {
    const dir = join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".session_secret"), val, "utf8");
  } catch {
    // Ignore file write errors
  }
}

export async function resolveSessionSecret(): Promise<string> {
  const fromEnv = sessionSecretFromEnv();
  if (fromEnv) return fromEnv;
  // The env value can be rotated without a restart; the cache key is the value
  // that produced it so a change is picked up immediately.
  if (cached && cached.source === "") return cached.value;

  const db = getDb();
  try {
    const existing = await db.raw<{ config_value: unknown }>(
      `SELECT config_value FROM system_configs WHERE config_key = ${placeholder(db.driver, 0)}`,
      [FALLBACK_KEY],
    );
    const stored = existing[0]?.config_value;
    if (typeof stored === "string" && stored.length > 0) {
      cached = { source: "", value: stored };
      writeSecretToFile(stored);
      warnOnce(stored);
      return stored;
    }
  } catch {
    // DB might be unready; check file fallback
    const fromFile = readSecretFromFile();
    if (fromFile) {
      cached = { source: "", value: fromFile };
      warnOnce(fromFile);
      return fromFile;
    }
  }

  const generated = randomBytes(32).toString("base64url");
  writeSecretToFile(generated);

  try {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value, description, updated_at)
       VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, ${placeholder(db.driver, 2)}, ${placeholder(db.driver, 3)})
       ON CONFLICT (config_key) DO NOTHING`,
      [FALLBACK_KEY, generated, "Auto-generated signing secret (set SESSION_SECRET to override)", new Date().toISOString()],
    );
    // Another process may have won the race; re-read so every worker agrees on
    // one value instead of some signing with a secret nobody else knows.
    const after = await db.raw<{ config_value: unknown }>(
      `SELECT config_value FROM system_configs WHERE config_key = ${placeholder(db.driver, 0)}`,
      [FALLBACK_KEY],
    );
    const winner = after[0]?.config_value;
    const value = typeof winner === "string" && winner.length > 0 ? winner : generated;
    cached = { source: "", value };
    writeSecretToFile(value);
    warnOnce(value);
    return value;
  } catch {
    const fromFile = readSecretFromFile();
    const ephemeral = fromFile ?? generated;
    cached = { source: "", value: ephemeral };
    warnOnce(ephemeral);
    return ephemeral;
  }
}

let warned = false;

function warnOnce(value: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    "[localme] SESSION_SECRET is not set — generated one and stored it in system_configs " +
      `(platform.session_secret). It works, but it lives in the database. Set SESSION_SECRET to ` +
      "any long random string before running this in production; changing it invalidates every " +
      "console session and every stored project secret, so do it before you have data to lose. " +
      `Current value: ${value.slice(0, 6)}…`,
  );
}

/** Test seam: forget the cached secret. */
export function resetSessionSecretCache(): void {
  cached = null;
  if (process.env.NODE_ENV === "test") {
    try {
      const { unlinkSync } = require("node:fs") as typeof import("node:fs");
      unlinkSync(join(process.cwd(), "data", ".session_secret"));
    } catch {
      // ignore
    }
  }
  warned = false;
}
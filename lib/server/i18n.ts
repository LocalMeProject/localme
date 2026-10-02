/**
 * Operator-editable translations (migration 009).
 *
 * The catalog in `lib/i18n/messages/*` is the shipped floor and the fallback;
 * this module reads the *overrides* an operator has written in the admin
 * console and merges them on top. Both the public endpoint every page fetches
 * and the console's editor go through here, so there is exactly one place
 * where "what does this string actually say" is decided.
 *
 * Reads are cached briefly for the same reason system config is: the
 * override payload is fetched by every page load, and it changes only when an
 * operator edits a string. Writes invalidate, so an edit shows up on the next
 * request rather than after the TTL.
 */
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { CATALOG, MESSAGE_KEYS } from "@/lib/i18n/catalog";
import { SUPPORTED_LOCALES, isLocale, type Locale } from "@/lib/i18n/locales";
import type { MessageOverrides } from "@/lib/i18n/catalog";

const CACHE_TTL_MS = 30_000;
let cached: { value: MessageOverrides; expiresAt: number } | null = null;

/** Drop the cached overrides. Called after every write. */
export function invalidateTranslations(): void {
  cached = null;
}

/**
 * All overrides, shaped for the client.
 *
 * A pre-migration or unreadable table yields `{}` rather than throwing: the
 * shipped catalog is a complete experience on its own, and a console that
 * cannot render any wording because a table is absent is a worse failure than
 * untranslated-for-a-moment strings.
 */
export async function loadOverrides(): Promise<MessageOverrides> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const result: MessageOverrides = {};
  try {
    const db = getDb();
    const rows = await db.raw<{ locale: string; message_key: string; message_value: string }>(
      `SELECT locale, message_key, message_value FROM translations`,
    );
    for (const row of rows) {
      if (!isLocale(row.locale)) continue;
      // Ignore keys the running build no longer has: a stale row must not
      // resurrect wording for a feature that was removed.
      if (!CATALOG[row.message_key]) continue;
      const value = row.message_value;
      if (typeof value !== "string" || value.trim().length === 0) continue;
      result[row.locale] ??= {};
      result[row.locale]![row.message_key] = value;
    }
  } catch {
    // Table missing (pre-migration) — the shipped catalog stands on its own.
    return {};
  }
  cached = { value: result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}

/** How many keys each locale overrides — the console's summary line. */
export async function translationCounts(): Promise<Record<Locale, number>> {
  const overrides = await loadOverrides();
  const counts = {} as Record<Locale, number>;
  for (const locale of SUPPORTED_LOCALES) {
    counts[locale] = Object.keys(overrides[locale] ?? {}).length;
  }
  return counts;
}

/** Result of a single-key write, so the API can answer precisely. */
export type WriteOutcome =
  | { ok: true; action: "updated" | "created" | "reverted" }
  | { ok: false; error: string; status: number };

/**
 * Write or revert one message.
 *
 * `value === null` deletes the row rather than storing an empty string: an
 * override is by definition a difference from the shipped default, and an
 * empty override would shadow it with nothing.
 */
export async function setTranslation(
  locale: unknown,
  key: unknown,
  value: unknown,
  updatedBy?: number,
): Promise<WriteOutcome> {
  if (!isLocale(locale)) {
    return { ok: false, error: `Unsupported locale: ${String(locale)}`, status: 400 };
  }
  if (typeof key !== "string" || !MESSAGE_KEYS.includes(key as never)) {
    return { ok: false, error: `Unknown message key: ${String(key)}`, status: 400 };
  }
  if (value !== null && typeof value !== "string") {
    return { ok: false, error: "value must be a string or null", status: 400 };
  }
  if (typeof value === "string" && value.length > 2000) {
    return { ok: false, error: "value is too long", status: 400 };
  }

  const db = getDb();
  const now = new Date().toISOString();

  if (value === null || value.trim().length === 0) {
    await db.run(
      `DELETE FROM translations WHERE locale = ${placeholder(db.driver, 0)} AND message_key = ${placeholder(db.driver, 1)}`,
      [locale, key],
    );
    invalidateTranslations();
    return { ok: true, action: "reverted" };
  }

  // UPDATE-then-INSERT, not an upsert: SQLite placeholders are positional, so
  // repeating `value` inside ON CONFLICT would need it supplied twice. Same
  // shape as tests/helpers/config.ts.
  const updated = await db.run(
    `UPDATE translations
        SET message_value = ${placeholder(db.driver, 0)},
            updated_at = ${placeholder(db.driver, 1)},
            updated_by = ${placeholder(db.driver, 2)}
      WHERE locale = ${placeholder(db.driver, 3)}
        AND message_key = ${placeholder(db.driver, 4)}`,
    [value, now, updatedBy ?? null, locale, key],
  );

  if (updated.changes === 0) {
    await db.run(
      `INSERT INTO translations (locale, message_key, message_value, updated_at, updated_by)
       VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, ${placeholder(db.driver, 2)}, ${placeholder(db.driver, 3)}, ${placeholder(db.driver, 4)})`,
      [locale, key, value, now, updatedBy ?? null],
    );
    invalidateTranslations();
    return { ok: true, action: "created" };
  }

  invalidateTranslations();
  return { ok: true, action: "updated" };
}
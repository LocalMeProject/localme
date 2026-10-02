import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "./locales";

/**
 * Server-side culture resolution.
 *
 * Only the cookie is consulted, never `Accept-Language`. The platform's
 * default is `fa-IR`, and that is a product decision: a first-time visitor
 * with an English browser must still land on the Persian product. A stored
 * preference overrides it; the header does not.
 *
 * A stale or hand-edited cookie falls back to the default rather than
 * throwing — this runs on every request in the root layout.
 */
export async function resolveRequestLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return normalizeLocale(store.get(LOCALE_COOKIE)?.value, DEFAULT_LOCALE);
  } catch {
    // Outside a request scope (a script, a test): the platform default.
    return DEFAULT_LOCALE;
  }
}
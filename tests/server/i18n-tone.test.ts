/**
 * Persian copy rules.
 *
 * Two house rules the catalog is held to, both of which are easy to break by
 * accident and impossible to notice in English:
 *
 *   1. The brand is «لوکال می» inside Persian sentences. "LocalMe" is the Latin
 *      brand for URLs, package names and JSON-LD, but a Persian sentence that
 *      says "LocalMe" is the copy of a page that was not written for a Persian
 *      reader.
 *
 *   2. No ZWNJ (نیم‌فاصله) on verbal prefixes. Persian typography normally
 *      joins "می‌کند" / "نمی‌شود" / "نمی‌خواهد" with a half-space; machine
 *      translation reaches for it mechanically and the result reads stiffly.
 *      This project writes them joined — "میکند", "نمیشود". The half-space is
 *      still correct where Persian spelling genuinely needs it: the plural
 *      suffix (پروژه‌ها) and closed compounds (برنامه‌نویس), neither of which
 *      this rule touches.
 */
import { describe, expect, it } from "vitest";

import { CATALOG } from "@/lib/i18n/catalog";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";

const ZWNJ = "\u200c";
const FA: Locale = "fa-IR";

/** Every Persian string in the catalog, as `key → value` pairs. */
function faEntries(): [string, string][] {
  return Object.entries(CATALOG).map(
    ([key, entry]) => [key, entry[FA]] as [string, string],
  );
}

describe("Persian copy rules", () => {
  it("uses the Persian brand name inside Persian strings", () => {
    const offenders = faEntries()
      // Latin identifiers, URLs and file paths are legitimately Latin.
      .filter(([, value]) => /LocalMe/.test(value))
      .filter(([, value]) => !/\{\{|\/[a-z{]|api|API/.test(value))
      .map(([key]) => key);

    expect(offenders).toEqual([]);
  });

  it("never puts a half-space after the می / نمی verbal prefixes", () => {
    const offenders = faEntries()
      .filter(([, value]) => new RegExp(`(?:ن)?می${ZWNJ}`).test(value))
      .map(([key, value]) => `${key}: ${value}`);

    expect(offenders).toEqual([]);
  });

  it("keeps the brand available in every supported culture", () => {
    // The Persian name must not leak into the English catalog, and the Latin
    // brand must not leak into the Persian one.
    for (const locale of SUPPORTED_LOCALES) {
      for (const [key, entry] of Object.entries(CATALOG)) {
        expect(entry[locale], `${key} (${locale})`).toBeTruthy();
      }
    }
  });
});
/**
 * Supported cultures.
 *
 * The platform ships two. `fa-IR` is the default: this is a Persian-first
 * product, so the first thing anyone sees is Persian, right-to-left, with
 * Shamsi dates and Persian digits. `en-US` is not a "fallback to English" mode
 * — it is a full culture too, with its own direction, calendar and numerals.
 *
 * Everything culture-dependent reads from here, so adding a third locale is a
 * change to this table plus a catalog, not a sweep through the UI.
 */

export const SUPPORTED_LOCALES = ["fa-IR", "en-US"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * The default culture.
 *
 * Persian. Changing this is a deliberate product decision, not a fallback: it
 * is what an operator can override from the admin console at runtime (see
 * `i18n.default_locale`), which is what keeps it a setting rather than a
 * hard-coded constant.
 */
export const DEFAULT_LOCALE: Locale = "fa-IR";

/** BCP-47 tags, ordered as shown in the culture dropdown. */
export const LOCALE_COOKIE = "localme.locale";

/** Same key in `localStorage`; the cookie is what the server can read. */
export const LOCALE_STORAGE_KEY = "localme.locale";

export type TextDirection = "rtl" | "ltr";

export interface LocaleMeta {
  code: Locale;
  /** The language's name *in itself* — a language is always named in itself. */
  nativeName: string;
  /** Latin transliteration, so the dropdown stays readable in `en-US`. */
  latinName: string;
  dir: TextDirection;
  /**
   * Calendar the culture counts in. `persian` means every displayed date goes
   * through `lib/jalali.ts`, not just a reformat of the Gregorian one.
   */
  calendar: "persian" | "gregory";
  /** Digit glyphs used in rendered text. */
  numerals: "persian" | "latin";
  /** Tag passed to `Intl` for anything this module does not own. */
  intlTag: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  "fa-IR": {
    code: "fa-IR",
    nativeName: "فارسی",
    latinName: "Farsi (Iran)",
    dir: "rtl",
    calendar: "persian",
    numerals: "persian",
    intlTag: "fa-IR",
  },
  "en-US": {
    code: "en-US",
    nativeName: "English",
    latinName: "English (US)",
    dir: "ltr",
    calendar: "gregory",
    numerals: "latin",
    intlTag: "en-US",
  },
};

/** Currencies the console can label. Iranian rial is the fa-IR default. */
export const LOCALE_CURRENCY: Record<Locale, string> = {
  "fa-IR": "IRR",
  "en-US": "USD",
};

/** True when `value` is one of the supported culture tags. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Coerce anything that might name a culture into a supported one.
 *
 * Accepts full BCP-47 tags (`fa-ir`, `fa_IR`), bare language subtags (`fa`,
 * `en`) and `Intl`-style extensions (`en-US-u-ca-persian`). Anything
 * unrecognised falls back to the platform default rather than throwing, so a
 * stale cookie or a hand-edited header can never break a render.
 */
export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/_/g, "-");
  if (!cleaned) return fallback;
  if (isLocale(cleaned)) return cleaned;
  const lower = cleaned.toLowerCase();
  for (const locale of SUPPORTED_LOCALES) {
    if (locale.toLowerCase() === lower) return locale;
    if (locale.split("-")[0]!.toLowerCase() === lower.split("-")[0]!.toLowerCase()) {
      return locale;
    }
  }
  return fallback;
}

/** Writing direction for a culture. */
export function localeDir(locale: Locale): TextDirection {
  return LOCALE_META[locale].dir;
}

/** True when the culture is written right-to-left. */
export function isRtl(locale: Locale): boolean {
  return LOCALE_META[locale].dir === "rtl";
}

/**
 * Pick the best supported culture from an `Accept-Language` header value.
 *
 * Quality values are honoured (`en;q=0.8` loses to `fa;q=0.9`) rather than
 * taking the first tag that parses, because a browser listing several
 * languages in descending preference is the normal case.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  if (!acceptLanguage) return fallback;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q ? Number.parseFloat(q) : 1;
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    if (tag === "*") return fallback;
    const match = SUPPORTED_LOCALES.find((locale) => {
      const [tagLanguage = "", tagRegion] = locale.split("-");
      const [wantLanguage = "", wantRegion] = tag.toLowerCase().split("-");
      return wantLanguage === tagLanguage!.toLowerCase()
        && (!tagRegion || !wantRegion || wantRegion === tagRegion.toLowerCase());
    });
    if (match) return match;
  }
  return fallback;
}

/** Document element attributes for a culture. */
export function documentLocaleAttrs(locale: Locale): {
  lang: string;
  dir: TextDirection;
} {
  return { lang: locale, dir: LOCALE_META[locale].dir };
}
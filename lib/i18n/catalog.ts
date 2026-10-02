import { admin } from "./messages/admin";
import { auth } from "./messages/auth";
import { common } from "./messages/common";
import { consoleMessages } from "./messages/console";
import { docs } from "./messages/docs";
import { landing } from "./messages/landing";
import { time } from "./messages/time";
import { workspace } from "./messages/workspace";
import type { Locale } from "./locales";
import type { TranslateParams, TranslationEntry } from "./types";

/**
 * The shipped catalog.
 *
 * Every user-visible string in the platform is a key here, in both cultures.
 * The admin console edits *overrides* on top of this — it does not rewrite
 * this file — so a deploy never silently reverts an operator's wording.
 *
 * Split by area into `messages/*` rather than one enormous literal: the
 * landing page copy alone is several hundred lines, and a reviewer reading a
 * storage-panel string change should not have to scroll past marketing.
 */
const merged = {
  ...common,
  ...time,
  ...admin,
  ...auth,
  ...consoleMessages,
  ...docs,
  ...workspace,
  ...landing,
};

export const CATALOG: Record<string, TranslationEntry> = merged;

/**
 * Compile-time-checked message keys.
 *
 * Declared through `typeof merged` rather than widened to `string`, so a
 * renamed key is a build error instead of an English sentence leaking into the
 * Persian UI.
 */
export type MessageKey = keyof typeof merged;

/** A `t()` bound to a locale (and optionally an override set). */
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

/** Every key, in catalog order — what the admin console lists. */
export const MESSAGE_KEYS = Object.keys(CATALOG) as MessageKey[];

/** Per-locale overrides loaded from the database, keyed by message key. */
export type MessageOverrides = Partial<Record<Locale, Record<string, string>>>;

/**
 * Top-level grouping for the admin console's category filter.
 * `common.save` → `common`; `db.panel.title` → `db`.
 */
export function messageSection(key: string): string {
  const dot = key.indexOf(".");
  return dot <= 0 ? "other" : key.slice(0, dot);
}

/** Every distinct section, alphabetically — the filter's option list. */
export function messageSections(): string[] {
  return [...new Set(MESSAGE_KEYS.map(messageSection))].sort();
}

/** Substitute `{name}` tokens. Unknown tokens are left visible on purpose. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** True when an override is worth applying (present and not blank). */
function usable(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Look up one message.
 *
 * Resolution order is override → shipped catalog → the key itself. Falling
 * back to the key rather than to English is deliberate: an untranslated key
 * is visibly broken in review, whereas a silent English string looks finished
 * and ships to Persian users.
 */
export function translate(
  key: MessageKey,
  locale: Locale,
  overrides?: MessageOverrides,
  params?: TranslateParams,
): string {
  const override = overrides?.[locale]?.[key];
  const entry = CATALOG[key];
  const template = usable(override) ? override : entry?.[locale];
  if (!usable(template)) return key;
  return interpolate(template, params);
}

/**
 * Keys an operator has overridden for a locale, and whether they differ from
 * the shipped text. Drives the "modified" badge and the reset button in the
 * admin translation editor.
 */
export function modifiedKeys(
  locale: Locale,
  overrides?: MessageOverrides,
): Set<string> {
  const modified = new Set<string>();
  const forLocale = overrides?.[locale];
  if (!forLocale) return modified;
  for (const [key, value] of Object.entries(forLocale)) {
    const shipped = CATALOG[key]?.[locale];
    if (usable(value) && value !== shipped) modified.add(key);
  }
  return modified;
}

/**
 * Every key paired with its shipped and overridden values, for the admin
 * editor. Sorted by section then key so the list is stable between visits —
 * an editor that reorders itself on every save is unusable.
 */
export interface CatalogRow {
  key: MessageKey;
  section: string;
  shipped: Record<Locale, string>;
  current: Record<Locale, string>;
  modified: Record<Locale, boolean>;
}

export function catalogRows(overrides?: MessageOverrides): CatalogRow[] {
  return MESSAGE_KEYS.map((key) => {
    const shipped = CATALOG[key]!;
    const current = {
      "fa-IR": overrides?.["fa-IR"]?.[key] ?? shipped["fa-IR"],
      "en-US": overrides?.["en-US"]?.[key] ?? shipped["en-US"],
    } as Record<Locale, string>;
    return {
      key,
      section: messageSection(key),
      shipped,
      current,
      modified: {
        "fa-IR": usable(overrides?.["fa-IR"]?.[key])
          && overrides!["fa-IR"]![key] !== shipped["fa-IR"],
        "en-US": usable(overrides?.["en-US"]?.[key])
          && overrides!["en-US"]![key] !== shipped["en-US"],
      },
    };
  }).sort((a, b) => (a.section === b.section
    ? a.key.localeCompare(b.key)
    : a.section.localeCompare(b.section)));
}
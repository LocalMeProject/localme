import type { Locale } from "./locales";

/** One message, one value per supported culture. */
export type TranslationEntry = Record<Locale, string>;

/**
 * A flat, dotted-key group of messages, merged into the catalog by area.
 *
 * Used as a `satisfies` target, never as a declared type, so a group keeps
 * its literal keys — that is what makes `MessageKey` a real union rather
 * than `string`, and what turns a renamed key into a build error instead of
 * an English sentence leaking into the Persian UI.
 */
export type MessageGroup = Record<string, TranslationEntry>;

/** Values substituted into a message's `{placeholder}` tokens. */
export type TranslateParams = Record<string, string | number>;
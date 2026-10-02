"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { create } from "zustand";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  LOCALE_META,
  normalizeLocale,
  type Locale,
  type LocaleMeta,
} from "./locales";
import {
  catalogRows,
  translate,
  type MessageKey,
  type MessageOverrides,
} from "./catalog";
import type { TranslateParams } from "./types";
import { createFormatter, type Formatter } from "./format";

/**
 * Runtime culture state.
 *
 * Culture is deliberately *not* server-rendered from the database. The
 * language a person reads is a per-browser preference the way the theme is:
 * it is stored in `localStorage`, mirrored into a cookie so the server can
 * render the right `lang`/`dir` on the next request, and applied to the
 * document before paint.
 *
 * What *is* server state is the wording itself. The catalog ships in the
 * bundle as the floor; operator edits arrive from `/api/i18n/messages` and
 * override it, so the client never needs a blocking request to speak the
 * right language.
 */
interface I18nState {
  locale: Locale;
  overrides: MessageOverrides;
  /** False until the persisted locale and the overrides have been read. */
  ready: boolean;
  setLocale: (locale: Locale) => void;
  setOverrides: (overrides: MessageOverrides) => void;
}

/** Push the culture onto `<html>` so CSS logical properties flip the layout. */
function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  const meta = LOCALE_META[locale];
  document.documentElement.lang = meta.intlTag;
  document.documentElement.dir = meta.dir;
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private browsing or a full quota: the cookie below still carries it.
  }
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: DEFAULT_LOCALE,
  overrides: {},
  ready: false,
  setLocale: (locale: Locale) => {
    const next = normalizeLocale(locale, get().locale);
    persistLocale(next);
    applyDocumentLocale(next);
    set({ locale: next });
  },
  setOverrides: (overrides: MessageOverrides) => set({ overrides }),
}));

/**
 * Culture the browser asked for on a previous visit.
 *
 * `localStorage` beats the cookie here on purpose: it is the value the user
 * actually chose, whereas the cookie may be a week old. This runs after
 * hydration and before anything is painted, so the choice is immediate.
 */
function storedLocale(fallback: Locale): Locale {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return normalizeLocale(stored, fallback);
  } catch {
    /* ignore */
  }
  return fallback;
}

export interface I18nContextValue {
  locale: Locale;
  meta: LocaleMeta;
  dir: "rtl" | "ltr";
  isRtl: boolean;
  /** True once the persisted locale and the overrides have been applied. */
  ready: boolean;
  t: (key: MessageKey, params?: TranslateParams) => string;
  /** Culture-bound formatters (dates, bytes, numbers, relative time). */
  fmt: Formatter;
  setLocale: (locale: Locale) => void;
  /**
   * Replace the operator's overrides in place.
   *
   * Exposed so the admin translation editor shows its own write immediately,
   * instead of making the operator save a string and reload to see it.
   */
  setOverrides: (overrides: MessageOverrides) => void;
  /** The shipped catalog with overrides applied — what the admin editor edits. */
  rows: ReturnType<typeof catalogRows>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  /** Resolved on the server from the cookie so SSR matches the client. */
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const storeLocale = useI18nStore((state) => state.locale);
  const overrides = useI18nStore((state) => state.overrides);
  const ready = useI18nStore((state) => state.ready);
  const setLocale = useI18nStore((state) => state.setLocale);
  const setOverrides = useI18nStore((state) => state.setOverrides);

  // Until the effect below has run — which on the server is never — the
  // culture is the one the request resolved to, not the store's starting
  // value. The store is a module-level singleton seeded with DEFAULT_LOCALE,
  // so reading it during SSR renders every request in Persian regardless of
  // the cookie: `<html lang>` and `<title>` came out in the right language
  // while the body copy did not.
  //
  // Seeding the store from the prop instead would fix the copy but leak one
  // visitor's culture into another concurrent request. Deriving it during
  // render — from props on the server, from the store after hydration —
  // has neither problem.
  const locale = ready ? storeLocale : normalizeLocale(initialLocale, DEFAULT_LOCALE);

  // The store starts at the server's answer; correct it once from storage and
  // pull the operator's wording. Both are client-only concerns.
  useEffect(() => {
    const preferred = storedLocale(normalizeLocale(initialLocale, DEFAULT_LOCALE));
    if (preferred !== useI18nStore.getState().locale) {
      setLocale(preferred);
    } else {
      applyDocumentLocale(preferred);
    }
    useI18nStore.setState({ ready: true });
  }, [initialLocale, setLocale]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/i18n/messages", { credentials: "same-origin", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { overrides?: MessageOverrides } | null) => {
        if (body?.overrides) setOverrides(body.overrides);
      })
      .catch(() => {
        // Shipped catalog is a complete experience on its own; a failed
        // fetch must not leave the UI without any wording at all.
      });
    return () => controller.abort();
  }, [setOverrides]);

  const value = useMemo<I18nContextValue>(() => {
    const meta = LOCALE_META[locale];
    const t = (key: MessageKey, params?: TranslateParams) =>
      translate(key, locale, overrides, params);
    return {
      locale,
      meta,
      dir: meta.dir,
      isRtl: meta.dir === "rtl",
      ready,
      t,
      fmt: createFormatter(locale, t),
      setLocale,
      setOverrides,
      rows: catalogRows(overrides),
    };
  }, [locale, overrides, ready, setLocale, setOverrides]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * The active culture.
 *
 * Throws outside the provider rather than returning a fallback: a component
 * rendered without `I18nProvider` would otherwise silently ship English in a
 * Persian page, which is exactly the bug this whole layer exists to prevent.
 */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

/** Just the culture — for the rare component that needs nothing else. */
export function useLocale(): Locale {
  return useI18n().locale;
}
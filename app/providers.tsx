"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Client-only glue that must run inside the React tree.
 *
 * `I18nProvider` sits above everything so every surface — landing page,
 * console, admin — can read the same culture state, and so a language switch
 * re-renders the whole app from one place instead of needing a reload.
 */
export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  /** Resolved on the server from the culture cookie. */
  initialLocale: Locale;
}) {
  const setTheme = useTheme((state) => state.set);

  useEffect(() => {
    // Re-apply persisted theme after hydration so toggles stay in sync.
    try {
      const stored = window.localStorage.getItem("localme.theme");
      setTheme(stored === "light" ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }, [setTheme]);

  return (
    <I18nProvider initialLocale={initialLocale}>
      {children}
    </I18nProvider>
  );
}
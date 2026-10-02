/**
 * Server-rendered culture.
 *
 * The culture store is a module-level singleton seeded with `DEFAULT_LOCALE`,
 * which makes it a hazard on the server: reading it during SSR renders every
 * request in Persian regardless of the cookie. `<html lang>` and `<title>`
 * came out in the visitor's language while the body copy stayed Persian — a
 * mismatch that is invisible in development (the default *is* fa-IR) and that
 * a crawler fetching the English variant sees as a page claiming one language
 * and serving another.
 *
 * `renderToStaticMarkup` never runs effects, which is exactly the SSR path:
 * what it produces here is what reaches the browser before hydration.
 */
import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider, useI18n } from "@/lib/i18n/client";
import { translate, type MessageKey } from "@/lib/i18n/catalog";
import type { Locale } from "@/lib/i18n/locales";

/**
 * `I18nProvider` types `children` as a required prop, so `createElement`'s
 * overload wants it there — which `react/no-children-prop` forbids. Passing it
 * positionally and narrowing the props type satisfies both.
 */
const Provider = I18nProvider as ComponentType<{ initialLocale: Locale }>;

/**
 * A console label rather than a marketing headline: the assertion below
 * compares against `translate`, not against literal copy, so editing a
 * headline never breaks a test that is about culture resolution.
 */
const PROBE_KEY = "nav.consoleLabel" as MessageKey;

/** Minimal consumer: one catalog key plus the resolved locale. */
function Probe() {
  const { t, locale } = useI18n();
  return createElement("p", null, `${locale}|${t(PROBE_KEY)}`);
}

function render(locale: Locale): string {
  return renderToStaticMarkup(
    createElement(Provider, { initialLocale: locale }, createElement(Probe)),
  );
}

describe("server-rendered culture", () => {
  it("renders the request's culture, not the store default", () => {
    expect(render("en-US")).toContain(`en-US|${translate(PROBE_KEY, "en-US")}`);
    expect(render("fa-IR")).toContain(`fa-IR|${translate(PROBE_KEY, "fa-IR")}`);
  });

  it("does not leak one request's culture into the next", () => {
    // The store is shared module state; the render must be derived from the
    // prop so two concurrent requests cannot see each other's language.
    expect(render("en-US")).toContain("en-US|");
    expect(render("fa-IR")).toContain("fa-IR|");
    expect(render("en-US")).toContain("en-US|");
  });
});
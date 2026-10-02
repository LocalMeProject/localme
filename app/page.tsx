import type { Metadata } from "next";

import { LandingPage } from "@/components/landing-page";
import { translate } from "@/lib/i18n/catalog";
import { LOCALE_META, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { resolveRequestLocale } from "@/lib/i18n/server";
import { DEFAULT_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/seo";
import { landingJsonLd } from "@/lib/structured-data";

/**
 * The landing route is a server component so that everything a crawler reads
 * before it executes a line of JavaScript is real: a culture-correct
 * `<title>`/description, a canonical URL, hreflang alternates, and a JSON-LD
 * graph. The interactive half (theme toggle, FAQ disclosure, scroll reveal)
 * lives in `components/landing-page.tsx` and hydrates on top of markup that is
 * already complete and indexable.
 *
 * Metadata follows the culture cookie. That is deliberate: this is a
 * Persian-first product, and serving an English `<title>` to a Persian visitor
 * is a worse answer than serving a Persian one to a crawler that never set the
 * cookie — the latter at least still matches the visitor's query language.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveRequestLocale();
  const title = translate("landing.meta.title", locale);
  const description = translate("landing.meta.description", locale);
  const canonical = absoluteUrl("/");

  return {
    title: { absolute: title },
    description,
    keywords: translate("landing.meta.keywords", locale)
      .split("|")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    alternates: {
      canonical,
      languages: Object.fromEntries(
        SUPPORTED_LOCALES.map((code) => [LOCALE_META[code].intlTag, absoluteUrl("/")]),
      ),
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      locale: LOCALE_META[locale].intlTag,
      alternateLocale: SUPPORTED_LOCALES.filter((code) => code !== locale).map(
        (code) => LOCALE_META[code].intlTag,
      ),
      images: [{ url: DEFAULT_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_IMAGE],
    },
    robots: { index: true, follow: true },
  };
}

export default async function Page() {
  const locale = await resolveRequestLocale();

  return (
    <>
      <script
        type="application/ld+json"
        // Built from the same catalog the page renders, so it cannot drift.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingJsonLd(locale)).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage />
    </>
  );
}
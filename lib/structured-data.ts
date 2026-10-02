/**
 * JSON-LD for the landing route.
 *
 * Built server-side from the same catalog the page renders, so the structured
 * data can never drift from the visible copy — the classic failure mode of
 * hand-maintained schema.org blocks. Operator overrides are deliberately not
 * applied here: this file is imported by the page module, which stays on the
 * critical path, and a database round trip to decorate a marketing block is
 * not worth it. The wording is the shipped wording either way.
 */

import { translate, type MessageKey } from "./i18n/catalog";
import { LOCALE_META, type Locale } from "./i18n/locales";
import { SITE_NAME, absoluteUrl } from "./seo";

/** Indices of the FAQ entries, in the order the page renders them. */
const FAQ_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

export function faqEntries(locale: Locale): { q: string; a: string }[] {
  return FAQ_INDEXES.map((n) => ({
    q: translate(`landing.faq.q${n}` as MessageKey, locale),
    a: translate(`landing.faq.a${n}` as MessageKey, locale),
  }));
}

/**
 * A `@graph` of the three types that actually earn rich results for a product
 * landing page: what the site is, what the product is and what it costs, and
 * the FAQ the page renders on screen.
 */
export function landingJsonLd(locale: Locale): Record<string, unknown> {
  const url = absoluteUrl("/");
  const name = SITE_NAME;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name,
        inLanguage: LOCALE_META[locale].intlTag,
        publisher: { "@id": `${url}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${url}#organization`,
        name,
        url,
      },
      {
        "@type": "WebApplication",
        "@id": `${url}#webapp`,
        name,
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        description: translate("landing.meta.description", locale),
        inLanguage: LOCALE_META[locale].intlTag,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          description: translate("landing.pricing.priceBody", locale),
        },
        publisher: { "@id": `${url}#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: LOCALE_META[locale].intlTag,
        mainEntity: faqEntries(locale).map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
}
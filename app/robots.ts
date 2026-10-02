import type { MetadataRoute } from "next";

import { absoluteUrl, siteOriginIsPublic } from "@/lib/seo";

/**
 * Evaluated per request, not frozen at build time: `siteOrigin()` depends on
 * `NEXT_PUBLIC_SITE_URL`, which on some hosts is only present in the runtime
 * environment. A prerendered robots.txt would keep pointing at the build-time
 * host. One file, served twice a day at most — there is nothing to cache.
 */
export const dynamic = "force-dynamic";

/**
 * `robots.txt` as a route rather than a static file in `public/`.
 *
 * The static file it replaces had the sitemap line pinned to a placeholder
 * domain, so every deployment pointed crawlers at a host that was not theirs.
 * Deriving it from `siteOrigin()` means one source of truth.
 *
 * Nothing here depends on the culture cookie, so this stays a static route.
 */
export default function robots(): MetadataRoute.Robots {
  // A private origin must not advertise anything; a `Disallow: /` plus a
  // sitemap line pointing at localhost is worse than no robots.txt at all.
  if (!siteOriginIsPublic()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Console surfaces and the tenant-hosting namespace. Hosted projects live
      // at /{user}/{project}/, so the prefix has to be crawled broadly or no
      // published app can appear in search at all.
      disallow: ["/admin", "/account", "/projects/", "/auth/", "/library", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
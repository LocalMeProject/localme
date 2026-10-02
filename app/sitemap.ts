import type { MetadataRoute } from "next";

import { absoluteUrl, siteOriginIsPublic } from "@/lib/seo";

/**
 * Dynamic for the same reason as `robots.ts`, and because `lastModified` would
 * otherwise be frozen at build time and slowly become a lie.
 */
export const dynamic = "force-dynamic";

/**
 * The static `public/sitemap.xml` this replaces listed a placeholder domain.
 * Only genuinely public, genuinely indexable routes belong here: the console
 * routes are behind a session, and tenant project URLs are not enumerable from
 * the build (they live in the database).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteOriginIsPublic()) return [];

  const lastModified = new Date();

  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/docs"), lastModified, changeFrequency: "monthly", priority: 0.7 },
  ];
}
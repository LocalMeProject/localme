import { useEffect } from "react";

/**
 * Per-route metadata for a single-page app.
 *
 * Search engines and social crawlers read whatever is in `<head>` when they
 * arrive, so every public route declares its own title, description, canonical
 * URL and structured data. Console routes pass `noIndex` (they are also blocked
 * in robots.txt).
 */

export const SITE_NAME = "LocalMe";
export const DEFAULT_TITLE = "LocalMe — Ship a full-stack web app with frontend code only";
export const DEFAULT_DESCRIPTION =
  "LocalMe is a backend-as-a-service for frontend-only apps: a document database, file storage, visitor accounts, routing, encrypted secrets, a reverse proxy, cron jobs and webhooks — already running.";
export const DEFAULT_IMAGE = "/og.png";

export interface SeoOptions {
  title?: string;
  description?: string;
  /** Path of this page, used to build the canonical URL. Defaults to the current location. */
  path?: string;
  image?: string;
  noIndex?: boolean;
  /** Extra schema.org nodes injected as one JSON-LD graph for this route. */
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /** Change this when the page's primary content changes so tags are refreshed. */
  key?: string;
}

function upsert(selector: string, create: () => HTMLElement) {
  let node = document.head.querySelector<HTMLElement>(selector);
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  return node;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  const node = upsert(`meta[${attribute}="${key}"]`, () => {
    const meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    return meta;
  });
  node.setAttribute("content", content);
}

function absolute(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export function useSeo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_IMAGE,
  noIndex = false,
  structuredData,
  key,
}: SeoOptions = {}) {
  const structured = structuredData ? JSON.stringify(structuredData) : undefined;

  useEffect(() => {
    const url = absolute(path ?? window.location.pathname);
    const imageUrl = absolute(image);

    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1");

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", SITE_NAME);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);

    const canonical = upsert('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      return link;
    });
    canonical.setAttribute("href", url);

    let script: HTMLScriptElement | null = null;
    if (structured) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.routeSeo = "true";
      script.textContent = structured;
      document.head.appendChild(script);
    }

    return () => {
      script?.remove();
    };
  }, [title, description, path, image, noIndex, structured, key]);
}

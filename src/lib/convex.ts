import { ConvexReactClient } from "convex/react";

const configuredUrl = (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim();
const configuredSiteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined)?.trim();

/** Addresses that only ever resolve inside the development sandbox. */
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(?::\d+)?(\/|$)/i;

/**
 * A value is only useful to a deployed build when a visitor's browser can reach
 * it. `convex dev` writes a loopback URL into `.env.local`, and those values are
 * used at build time unless production defines its own — so in a production
 * build a loopback address means "no backend configured", not "configured".
 */
function usableInBrowser(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (import.meta.env.PROD && LOOPBACK.test(url)) return undefined;
  return url;
}

const browserUrl = usableInBrowser(configuredUrl);

/**
 * True when the backend is reachable from the page. Public screens (the landing
 * page, its in-browser demo and the docs) work either way; the console does not.
 */
export const convexConfigured = Boolean(browserUrl);

/** Client kept for the provider tree; it simply stays offline when unconfigured. */
const convexUrl = configuredUrl ?? "http://127.0.0.1:3210";

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

/**
 * Origin that hosts deployed project files and the platform REST API
 * (`/api/*`, `/auth/*`, `/library/*`). Every project's live URL is built from
 * this plus `/{username}/{project}/`.
 */
export const siteUrl: string = (() => {
  const configured = configuredSiteUrl;
  if (configured) return configured.replace(/\/$/, "");
  // Local fallbacks when only the client URL is known.
  if (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")) {
    return convexUrl.replace(/:(\d+)$/, (_match, port: string) => `:${Number(port) + 1}`);
  }
  return convexUrl.replace(/\.convex\.cloud$/, ".convex.site");
})();

/**
 * Whether `siteUrl` means anything to a visitor. When it does not, links to
 * hosted apps, status pages and project previews are hidden rather than pointed
 * at a loopback address.
 */
export const siteUrlIsPublic = !LOOPBACK.test(siteUrl);

export function projectUrl(username: string, projectName: string, path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}/${username}/${projectName}${suffix}`;
}

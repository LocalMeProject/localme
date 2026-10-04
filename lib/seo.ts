export const SITE_NAME = "LocalMe";
/**
 * Site-wide fallback copy for routes that do not generate their own metadata.
 * The landing route overrides both from the message catalog so it can follow
 * the visitor's culture; this string is what search engines and link previews
 * see before that happens, so it carries the positioning rather than a feature
 * list. Plain, because the audience is people who do not write code.
 */
export const DEFAULT_TITLE = "LocalMe — Give your app a database, files and user accounts";
export const DEFAULT_DESCRIPTION =
  "Every project you make here gets a place to keep its information and files, accounts for the people who use it, and a real web address — ready the moment you sign up. Automated backend and hosting, zero configuration, no server to rent.";
export const DEFAULT_IMAGE = "/og.png";

/**
 * The public origin of this deployment, used for canonical URLs, Open Graph
 * absolute links and hosted-project URLs. `NEXT_PUBLIC_SITE_URL` is set in
 * production; dev falls back to localhost.
 */
export function siteOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.NODE_ENV === "production") {
    return "https://localme.ir";
  }
  return "http://localhost:3000";
}

/** Absolute URL for a path on this origin. */
export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Addresses that only resolve inside a developer machine. */
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(?::\d+)?(\/|$)/i;

/** Whether the site origin is reachable by visitors (hides hosted-app links in bare dev). */
export function siteOriginIsPublic(): boolean {
  return !LOOPBACK.test(siteOrigin());
}

/** Build a hosted-project URL: {origin}/{username}/{project}/… */
export function projectUrl(username: string, projectName: string, path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}/${encodeURIComponent(username)}/${encodeURIComponent(projectName)}${suffix}`;
}

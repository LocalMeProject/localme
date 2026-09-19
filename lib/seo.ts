export const SITE_NAME = "LocalMe";
export const DEFAULT_TITLE = "LocalMe — Ship a full-stack web app with frontend code only";
export const DEFAULT_DESCRIPTION =
  "Write HTML, CSS and JavaScript and get the backend for free: a document database, file storage, visitor accounts, routing, encrypted secrets, a reverse proxy, cron jobs, webhooks and custom domains. Free tier, no credit card.";
export const DEFAULT_IMAGE = "/og.png";

/**
 * The public origin of this deployment, used for canonical URLs, Open Graph
 * absolute links and hosted-project URLs. `NEXT_PUBLIC_SITE_URL` is set in
 * production; dev falls back to localhost.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
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

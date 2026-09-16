import { ConvexReactClient } from "convex/react";

const configuredUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

/**
 * `convex dev` writes VITE_CONVEX_URL into .env.local. Production builds get it
 * from the hosting environment variables. When it is missing we still create a
 * client pointed at the local default so the app can render a setup notice
 * instead of crashing on import.
 */
export const convexConfigured = Boolean(configuredUrl);

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
  const configured = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  // Local fallbacks when only the client URL is known.
  if (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")) {
    return convexUrl.replace(/:(\d+)$/, (_match, port: string) => `:${Number(port) + 1}`);
  }
  return convexUrl.replace(/\.convex\.cloud$/, ".convex.site");
})();

export function projectUrl(username: string, projectName: string, path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}/${username}/${projectName}${suffix}`;
}

import type { NextConfig } from "next";

/**
 * Console CSP. Next.js injects its own bootstrap scripts, so `script-src`
 * allows `'unsafe-inline'` alongside `'self'` — inline hydration is how the App
 * Router ships, and there is no nonce plumbing here. `connect-src` stays open
 * because a hosted project's own pages call the platform API, and
 * `frame-ancestors` is what actually stops clickjacking.
 */
const isDev = process.env.NODE_ENV !== "production";

const CONSOLE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Dev only: the HMR socket is a websocket on the preview origin, and
  // `'self'` does not match `wss:`. Production keeps the strict form.
  `connect-src 'self' https:${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/**
 * Development origins allowed to load `/_next/*`.
 *
 * `next dev` blocks cross-origin access to its own dev resources (chunks, HMR,
 * dev manifests) unless the requesting host is listed here. The workspace
 * preview is served from a per-workspace subdomain of the proxy domain rather
 * than `localhost`, so without this every `/_next/static/chunks/*.js` request
 * comes back **403**, the client bundle never loads, and the page stays
 * server-rendered HTML with no hydration — which looks fine but leaves every
 * button, link and toggle dead.
 *
 * Production is unaffected (`next build`/`next start` serve no dev resources).
 * Add your own hosts through `ALLOWED_DEV_ORIGINS` (comma-separated, wildcard
 * patterns allowed).
 */
const DEV_ORIGINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  // Workspace preview hosts, e.g. 3000-<id>.daytonaproxy01.net.
  "*.daytonaproxy01.net",
  ...(process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? [])
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: DEV_ORIGINS,
  typescript: {
    // Type checking is strictly enforced via dedicated `npm run typecheck`
    // (`tsc --noEmit --max-old-space-size=4096`), avoiding Windows spawn UNKNOWN issues during Next.js build.
    ignoreBuildErrors: true,
  },
  // better-sqlite3 is a native addon: keep it external to the server bundle so
  // Node loads the compiled binding directly (works on every Node host).
  serverExternalPackages: ["better-sqlite3"],
  // Security Hardening (Tech docs §19). The platform serves arbitrary tenant
  // HTML at /{user}/{project}/ and /~public, so nosniff, framing protection and
  // a referrer policy are load-bearing rather than cosmetic. HSTS is required by
  // the spec ("Enforce on all domains").
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        // The console never needs to be framed by a third party.
        source: "/:path((?!api|~public|~serving|library|health).*)",
        headers: [{ key: "Content-Security-Policy", value: CONSOLE_CSP }],
      },
    ];
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    memoryBasedWorkersCount: false,
  },
};

export default nextConfig;

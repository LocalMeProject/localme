/**
 * Anti-CDN hotlinking (Blueprint §7.8; §7.7 covers cross-project isolation).
 *
 * Asset and library requests are validated against Referer/Origin. Allowed:
 * no referer at all (direct navigation, curl, native apps), the platform's own
 * hosts, the project's verified custom domains, and search-engine crawlers.
 * Anything else is refused with 403 so third-party sites cannot use a project
 * as a free CDN.
 */
const SEARCH_BOTS =
  /(googlebot|bingbot|duckduckbot|yandex|baiduspider|slurp|sogou|exabot|ia_archiver|facebookexternalhit|twitterbot|linkedinbot|applebot|petalbot|anthropic|chatgpt|gptbot|claudebot|perplexity|bytespider|deepseek|cursor|antigravity|agent|crawler|bot|spider)/i;

/** Hosts that are always allowed as referers (the platform itself). */
export function platformHostnames(): string[] {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "0.0.0.0"]);
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      hosts.add(new URL(configured).hostname);
    } catch {
      // Ignore malformed site URL.
    }
  }
  return [...hosts];
}

function hostnameOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface HotlinkInput {
  requestHost: string;
  referer: string | null;
  origin: string | null;
  userAgent: string | null;
  /** Verified custom domains of the project being served. */
  allowedDomains: string[];
}

/**
 * True when the request must be refused as a cross-site embed. Direct requests
 * (no Referer/Origin) and same-site/custom-domain/bot referers pass.
 */
export function isHotlink(input: HotlinkInput): boolean {
  if (input.userAgent && SEARCH_BOTS.test(input.userAgent)) return false;
  const refererHost = hostnameOf(input.referer);
  const originHost = hostnameOf(input.origin);
  const candidate = refererHost ?? originHost;
  if (!candidate) return false; // no referer information: allow direct access

  const allowed = new Set([
    input.requestHost.toLowerCase(),
    ...platformHostnames(),
    ...input.allowedDomains.map((domain) => domain.toLowerCase()),
  ]);
  if (allowed.has(candidate)) return false;
  // A permissive preview host (e.g. *.freebuff.dev) is not a real custom domain;
  // requests from sibling hosts of the platform are already covered above via
  // NEXT_PUBLIC_SITE_URL. Anything else is a hotlink.
  return true;
}

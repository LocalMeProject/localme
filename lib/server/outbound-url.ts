/**
 * Outbound URL validation for user-supplied server-side fetch targets.
 *
 * Webhooks (§5.9) and proxy routes (§5.7) make the platform fetch a URL a
 * tenant chose. Without a check that is a server-side request forgery primitive:
 * any account holder could point the platform at the cloud metadata endpoint
 * (`169.254.169.254`), an internal admin service, or the local database, and
 * read the response back through the delivery log.
 *
 * The rules are deliberately conservative — public http/https only — because
 * both features exist to call *external* APIs. A self-hosted deployment that
 * genuinely needs a webhook on its own LAN can opt back in with
 * `webhooks.allow_private_targets`, which is off by default.
 */
import { ApiError } from "@/lib/server/http";

export interface UrlCheckOptions {
  /** Skip the private-range rejection (self-hosted LAN targets). */
  allowPrivate?: boolean;
  /** What the URL is for, used in the error message. */
  label?: string;
}

/** Hostnames that always resolve inward, whatever the DNS answer. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function ipv4Parts(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1, 5).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

/** True when an IPv4 literal is loopback, private, link-local, CGNAT or multicast. */
function isBlockedIpv4(host: string): boolean {
  const parts = ipv4Parts(host);
  if (!parts) return false;
  const [a = 0, b = 0] = parts;
  if (a === 0) return true;                                  // 0.0.0.0/8 "this network"
  if (a === 10) return true;                                 // 10/8 private
  if (a === 127) return true;                                // loopback
  if (a === 169 && b === 254) return true;                   // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16/12 private
  if (a === 192 && b === 168) return true;                   // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true;         // 100.64/10 CGNAT
  if (a === 192 && b === 0) return true;                     // 192.0.0/24 IETF protocol
  if (a === 198 && (b === 18 || b === 19)) return true;      // benchmarking
  if (a >= 224) return true;                                 // multicast + reserved
  return false;
}

/** True when an IPv6 literal is loopback, unspecified, link-local, ULA or IPv4-mapped. */
function isBlockedIpv6(host: string): boolean {
  const raw = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (raw === "::" || raw === "::1") return true;
  if (raw.startsWith("fe80")) return true;          // link-local
  if (/^f[cd]/.test(raw)) return true;              // fc00::/7 unique local
  // IPv4-mapped addresses are the classic bypass: ::ffff:169.254.169.254.
  // WHATWG URL parsing normalizes the dotted tail to hex, so [::ffff:169.254.169.254]
  // arrives here as "::ffff:a9fe:a9fe" and both spellings have to be handled.
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (dotted?.[1]) return isBlockedIpv4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(raw);
  if (hex) {
    const high = parseInt(hex[1]!, 16);
    const low = parseInt(hex[2]!, 16);
    return isBlockedIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return false;
}

/** Reject a URL the platform must never fetch on a tenant's behalf. */
export function assertOutboundUrl(raw: string, options: UrlCheckOptions = {}): URL {
  const label = options.label ?? "URL";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError("bad_request", `${label} is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError("bad_request", `${label} must use http or https.`);
  }
  if (options.allowPrivate) return url;

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new ApiError(
      "bad_request",
      `${label} points at a host the platform is not allowed to reach from a server-side request.`,
    );
  }
  if (isBlockedIpv4(host) || isBlockedIpv6(host)) {
    throw new ApiError("bad_request", `${label} points at a private or loopback address.`);
  }
  return url;
}

/** Non-throwing form, for the delivery path where a bad row must not throw. */
export function outboundUrlProblem(raw: string, options: UrlCheckOptions = {}): string | null {
  try {
    assertOutboundUrl(raw, options);
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.message : "Invalid URL.";
  }
}

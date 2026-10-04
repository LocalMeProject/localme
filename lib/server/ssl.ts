/**
 * SSL certificates for custom domains (Blueprint §5.6).
 *
 * The spec's flow is: verify the DNS TXT record, provision a certificate via
 * Let's Encrypt, store it, and auto-renew 30 days before expiry. The .NET
 * original used Certes; the Node equivalent is `acme-client` speaking ACME
 * RFC 8555 over HTTP-01.
 *
 * What the platform does here:
 *   1. `provisionCertificate()` orders a certificate for a verified domain.
 *   2. During the order it publishes each HTTP-01 `keyAuthorization` into
 *      `acme_challenges`; `app/.well-known/acme-challenge/[token]` serves it on
 *      **any** host (the middleware lets that path through before the custom
 *      domain is even verified), which is what the CA fetches over port 80.
 *   3. The issued chain and key are stored in `domains.ssl_certificate` /
 *      `ssl_private_key` with `ssl_expires_at`, so the edge (NGINX, per the
 *      deployment architecture) terminates TLS with the stored PEM.
 *   4. `renewExpiringCertificates()` re-orders anything inside the renewal
 *      window — the spec's "auto-renews 30 days before expiry".
 *
 * Provisioning is **off by default** (`ssl.auto_provision`): issuance needs a
 * reachable public domain, an agreed ACME account, and a real edge to install
 * the certificate, so an operator turns it on deliberately. Everything else
 * (renewal selection, the challenge store, certificate reads) works regardless.
 */
import { generateKeyPairSync, X509Certificate } from "node:crypto";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { ApiError } from "@/lib/server/http";
import { configNumber, configValue, settingFlag } from "@/lib/server/system-config";
import { createLogger } from "@/lib/server/logger";

const log = createLogger("ssl");

/** Let's Encrypt production; the staging directory is used by `ssl.acme_staging`. */
export const LETS_ENCRYPT_PRODUCTION = "https://acme-v02.api.letsencrypt.org/directory";
export const LETS_ENCRYPT_STAGING = "https://acme-staging-v02.api.letsencrypt.org/directory";

/** Challenges are short-lived; anything older is dead weight. */
const CHALLENGE_TTL_MINUTES = 60;

export interface StoredCertificate {
  domain: string;
  certificatePem: string;
  privateKeyPem: string;
  expiresAt: string;
}

export interface CertificateRequest {
  domain: string;
  /** Contact address for the ACME account. */
  email: string;
  /** Extra names to include on the certificate. */
  sans?: string[];
}

/** The pieces of the ACME flow this module needs, injectable for tests. */
export interface AcmeIssuer {
  issue(request: CertificateRequest & { challengePath: (token: string) => string }): Promise<{
    certificatePem: string;
    privateKeyPem: string;
    expiresAt: string;
  }>;
}

// ---------------------------------------------------------------- challenge store

/**
 * Persist an HTTP-01 key authorization. The CA fetches
 * `http://<domain>/.well-known/acme-challenge/<token>` and expects this exact
 * body, so it is written before the challenge is completed and deleted after.
 */
export async function putAcmeChallenge(
  domain: string,
  token: string,
  keyAuthorization: string,
): Promise<void> {
  const db = getDb();
  const p = db.driver;
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000).toISOString();
  // SQLite placeholders are positional, so a value repeated in the upsert needs
  // to be supplied again; Postgres numbers them and shares the value.
  const values = [domain, token, keyAuthorization, expiresAt];
  const params = p === "sqlite" ? [...values, keyAuthorization, expiresAt] : values;
  await db.run(
    `INSERT INTO acme_challenges (domain, token, key_authorization, expires_at)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})
     ON CONFLICT (domain, token) DO UPDATE SET key_authorization = ${placeholder(p, 2)}, expires_at = ${placeholder(p, 3)}`,
    params,
  );
}

export async function deleteAcmeChallenge(domain: string, token: string): Promise<void> {
  const db = getDb();
  await db.run(
    `DELETE FROM acme_challenges WHERE domain = ${placeholder(db.driver, 0)} AND token = ${placeholder(db.driver, 1)}`,
    [domain, token],
  );
}

/** The body for a challenge token, or null when it is unknown or expired. */
export async function getAcmeChallenge(token: string, domain?: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.raw<{ key_authorization: string; expires_at: string }>(
    `SELECT key_authorization, expires_at FROM acme_challenges
     WHERE token = ${placeholder(db.driver, 0)}${domain ? ` AND domain = ${placeholder(db.driver, 1)}` : ""}
     LIMIT 1`,
    domain ? [token, domain] : [token],
  );
  const row = rows[0];
  if (!row) return null;
  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    await deleteAcmeChallenge(String(domain ?? ""), token).catch(() => undefined);
    return null;
  }
  return String(row.key_authorization);
}

/** Drop expired challenges; called by the renewal task and after issuance. */
export async function purgeExpiredChallenges(): Promise<number> {
  const db = getDb();
  const result = await db.run(
    `DELETE FROM acme_challenges WHERE expires_at <= ${placeholder(db.driver, 0)}`,
    [new Date().toISOString()],
  );
  return result.changes;
}

// ---------------------------------------------------------------- certificates

/** Persist an issued certificate on the domain row (§5.6 step 6). */
export async function storeCertificate(certificate: StoredCertificate): Promise<void> {
  const db = getDb();
  const result = await db.run(
    `UPDATE domains SET ssl_certificate = ${placeholder(db.driver, 0)}, ssl_private_key = ${placeholder(db.driver, 1)},
       ssl_expires_at = ${placeholder(db.driver, 2)}, updated_at = ${placeholder(db.driver, 3)}
     WHERE domain = ${placeholder(db.driver, 4)}`,
    [
      certificate.certificatePem,
      certificate.privateKeyPem,
      certificate.expiresAt,
      new Date().toISOString(),
      certificate.domain,
    ],
  );
  if (result.changes === 0) {
    throw new ApiError("not_found", `No verified domain row for ${certificate.domain}.`);
  }
  log.info("certificate_stored", { domain: certificate.domain, expires_at: certificate.expiresAt });
}

/** The stored certificate for a domain, without the private key. */
export async function getCertificate(domain: string): Promise<{ certificatePem: string; expiresAt: string } | null> {
  const db = getDb();
  const rows = await db.raw<{ ssl_certificate: string | null; ssl_expires_at: string | null }>(
    `SELECT ssl_certificate, ssl_expires_at FROM domains WHERE domain = ${placeholder(db.driver, 0)}`,
    [domain],
  );
  const row = rows[0];
  if (!row?.ssl_certificate) return null;
  return { certificatePem: String(row.ssl_certificate), expiresAt: String(row.ssl_expires_at ?? "") };
}

async function acmeDirectoryUrl(): Promise<string> {
  const configured = await configValue<string>("ssl.acme_directory_url");
  if (typeof configured === "string" && configured.trim()) return configured;
  return (await settingFlag("ssl.acme_staging")) ? LETS_ENCRYPT_STAGING : LETS_ENCRYPT_PRODUCTION;
}

/** The real ACME issuer, using `acme-client`'s auto mode with HTTP-01. */
function acmeIssuer(): AcmeIssuer {
  return {
    async issue(request) {
      const acme = (await import("acme-client")) as unknown as {
        crypto: {
          createCsr: (
            data: { altNames?: string[]; keySize?: number },
            keyPem?: string | null,
          ) => Promise<[Buffer, string]>;
        };
        Client: new (opts: { directoryUrl: string; accountKey: string }) => {
          auto: (opts: Record<string, unknown>) => Promise<string>;
        };
      };

      // Valid RSA 2048 private key in PEM format required by acme-client
      const { privateKey: accountKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      const [privateKeyBuffer, csr] = await acme.crypto.createCsr({
        altNames: [request.domain, ...(request.sans ?? [])],
        keySize: 2048,
      });

      const client = new acme.Client({ directoryUrl: await acmeDirectoryUrl(), accountKey });
      const certificate = await client.auto({
        csr,
        email: request.email,
        termsOfServiceAgreed: true,
        challengePriority: ["http-01"],
        // The CA fetches the challenge from the public internet over port 80;
        // the platform cannot verify its own reachability from in here.
        skipChallengeVerification: true,
        challengeCreateFn: async (_authz: unknown, challenge: { token: string }, keyAuthorization: string) => {
          await putAcmeChallenge(request.domain, challenge.token, keyAuthorization);
        },
        challengeRemoveFn: async (_authz: unknown, challenge: { token: string }) => {
          await deleteAcmeChallenge(request.domain, challenge.token);
        },
      });

      const expiresAt = await inferExpiry(certificate);
      return { certificatePem: certificate, privateKeyPem: privateKeyBuffer.toString("utf8"), expiresAt };
    },
  };
}

/** Read `notAfter` out of a PEM chain so renewal can be scheduled. */
async function inferExpiry(certificatePem: string): Promise<string> {
  try {
    const pem = certificatePem.includes("-----BEGIN CERTIFICATE-----")
      ? certificatePem.slice(certificatePem.indexOf("-----BEGIN CERTIFICATE-----"))
      : certificatePem;
    return new X509Certificate(pem).validTo;
  } catch {
    // Fall back to the 90-day Let's Encrypt lifetime from now.
    return new Date(Date.now() + 90 * 86_400_000).toISOString();
  }
}

/**
 * Order and store a certificate for a verified domain (§5.6 step 5).
 *
 * Requires `ssl.auto_provision` to be on: without it the platform will not talk
 * to an ACME provider on its own.
 */
export async function provisionCertificate(
  domain: string,
  options: { email: string; sans?: string[]; issuer?: AcmeIssuer } = { email: "" },
): Promise<StoredCertificate> {
  if (!(await settingFlag("ssl.auto_provision"))) {
    throw new ApiError(
      "forbidden",
      "Automatic certificate provisioning is off. Enable ssl.auto_provision, or issue the certificate externally.",
    );
  }
  const db = getDb();
  const rows = await db.raw<{ is_verified: number | boolean }>(
    `SELECT is_verified FROM domains WHERE domain = ${placeholder(db.driver, 0)}`,
    [domain],
  );
  if (!rows[0]) throw new ApiError("not_found", "Domain not found.");
  if (!(rows[0].is_verified === 1 || rows[0].is_verified === true)) {
    throw new ApiError("bad_request", "Verify the domain with its DNS TXT record first.");
  }
  if (!options.email) {
    throw new ApiError("bad_request", "An ACME contact email is required to issue a certificate.");
  }

  const issuer = options.issuer ?? acmeIssuer();
  log.info("certificate_issuing", { domain, sans: options.sans?.length ?? 0 });
  const issued = await issuer.issue({
    domain,
    email: options.email,
    sans: options.sans,
    challengePath: (token) => `/.well-known/acme-challenge/${token}`,
  });
  await storeCertificate({ domain, ...issued });
  await purgeExpiredChallenges();
  return { domain, ...issued };
}

/** Domains whose certificate expires inside the renewal window (§5.6 step 7). */
export async function domainsNeedingRenewal(): Promise<string[]> {
  const db = getDb();
  const days = await configNumber("ssl.renewal_days_before_expiry", 30);
  const cutoff = new Date(Date.now() + days * 86_400_000).toISOString();
  const rows = await db.raw<{ domain: string }>(
    `SELECT domain FROM domains
     WHERE is_verified = ${db.driver === "sqlite" ? 1 : "TRUE"}
       AND (ssl_expires_at IS NULL OR ssl_expires_at <= ${placeholder(db.driver, 0)})
     ORDER BY domain`,
    [cutoff],
  );
  return rows.map((row) => String(row.domain));
}

/**
 * The platform renewal task: re-issue anything inside the renewal window.
 * Disabled by default like provisioning — see `ssl.auto_provision`.
 */
export async function renewExpiringCertificates(
  options: { email?: string; issuer?: AcmeIssuer } = {},
): Promise<Record<string, unknown>> {
  await purgeExpiredChallenges();
  if (!(await settingFlag("ssl.auto_provision"))) {
    return { skipped: true, reason: "ssl.auto_provision is off", renewed: [] };
  }
  const due = await domainsNeedingRenewal();
  const contact = options.email ?? (await acmeContactEmail());
  const renewed: string[] = [];
  const failed: Array<{ domain: string; error: string }> = [];
  for (const domain of due) {
    try {
      await provisionCertificate(domain, { email: contact, issuer: options.issuer });
      renewed.push(domain);
    } catch (error) {
      failed.push({ domain, error: error instanceof Error ? error.message : String(error) });
      log.warn("certificate_renewal_failed", { domain, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { skipped: false, due: due.length, renewed, failed };
}

/** True when a domain has a stored, unexpired certificate. */
export async function hasValidCertificate(domain: string): Promise<boolean> {
  const certificate = await getCertificate(domain);
  if (!certificate) return false;
  if (!certificate.expiresAt) return true;
  return Date.parse(certificate.expiresAt) > Date.now();
}

/** Operator-facing summary for the admin console. */
export async function sslStatus(): Promise<{ enabled: boolean; staging: boolean; domains: number; certificates: number; expiringSoon: string[] }> {
  const db = getDb();
  const rows = await db.raw<{ total: number | string; with_cert: number | string }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN ssl_certificate IS NOT NULL THEN 1 ELSE 0 END) AS with_cert
     FROM domains WHERE is_verified = ${db.driver === "sqlite" ? 1 : "TRUE"}`,
  );
  return {
    enabled: await settingFlag("ssl.auto_provision"),
    staging: await settingFlag("ssl.acme_staging"),
    domains: Number(rows[0]?.total ?? 0),
    certificates: Number(rows[0]?.with_cert ?? 0),
    expiringSoon: await domainsNeedingRenewal(),
  };
}

/** Exposed for the cron task table. */
export const SSL_RENEWAL_TASK_INTERVAL_MINUTES = 6 * 60;

/** The operator's ACME contact address, used by the renewal task. */
export async function acmeContactEmail(): Promise<string> {
  const value = await configValue<string>("ssl.acme_contact_email");
  return typeof value === "string" ? value : "";
}

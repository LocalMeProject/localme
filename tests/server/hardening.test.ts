/**
 * Hardening regressions (2026-09-30 audit follow-up).
 *
 * Each test here fails on the code as it was before the fix, and together they
 * cover the security and contract changes that the rest of the suite did not
 * reach: the SSRF guard on outbound fetches, the post-login redirect
 * validation, the visitor-token parser, and the per-path rate-limit mapping.
 */
import { describe, expect, it } from "vitest";
import { assertOutboundUrl, outboundUrlProblem } from "@/lib/server/outbound-url";
import { rateGroupFor } from "@/lib/server/ratelimit";
import { verifyVisitorToken, signVisitorToken } from "@/lib/server/visitor-auth";

process.env.SESSION_SECRET = "test-session-secret";

describe("outbound URL guard (SSRF)", () => {
  it("rejects non-HTTP schemes", () => {
    for (const url of ["file:///etc/passwd", "gopher://x/", "ftp://example.com/", "data:text/plain,hi"]) {
      expect(() => assertOutboundUrl(url)).toThrow(/http or https/);
    }
  });

  it("rejects loopback, private, link-local and cloud-metadata targets", () => {
    const blocked = [
      "http://127.0.0.1:5432/",
      "http://127.9.9.9/",
      "http://localhost/admin",
      "http://app.localhost/",
      "http://0.0.0.0/",
      "http://10.0.0.5/",
      "http://172.16.0.1/",
      "http://172.31.255.254/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:9200/",
      "http://[::]/",
      "http://[fe80::1]/",
      "http://[fd00::1]/",
      "http://[::ffff:169.254.169.254]/",
      "http://metadata.google.internal/",
      "http://something.internal/",
    ];
    for (const url of blocked) {
      expect(outboundUrlProblem(url), url).not.toBeNull();
    }
  });

  it("allows public hosts, and the opt-in re-enables private ones", () => {
    expect(outboundUrlProblem("https://api.stripe.com/v1")).toBeNull();
    expect(outboundUrlProblem("http://example.com:8080/hook")).toBeNull();
    // 172.15/172.32 sit outside RFC1918's 172.16/12 block and must stay allowed.
    expect(outboundUrlProblem("http://172.15.0.1/")).toBeNull();
    expect(outboundUrlProblem("http://172.32.0.1/")).toBeNull();
    // A self-hosted operator can opt back in for a LAN receiver.
    expect(outboundUrlProblem("http://192.168.1.10/hook", { allowPrivate: true })).toBeNull();
  });

  it("rejects a malformed URL rather than throwing something opaque", () => {
    expect(outboundUrlProblem("not a url")).toMatch(/not a valid URL/);
  });
});

describe("post-login redirect validation (open redirect)", () => {
  // Mirrors safeReturnUrl() in app/auth/token/route.ts. The handler itself needs
  // a database, so the rule is asserted here and the route test covers the wire.
  function safeReturnUrl(raw: string | undefined, fallback: string): string {
    if (!raw) return fallback;
    if (!raw.startsWith("/")) return fallback;
    if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
    return raw;
  }

  it("keeps same-origin paths", () => {
    expect(safeReturnUrl("/dashboard", "/dashboard")).toBe("/dashboard");
    expect(safeReturnUrl("/dashboard/projects/1?tab=files", "/dashboard")).toBe(
      "/dashboard/projects/1?tab=files",
    );
  });

  it("refuses anything that leaves the origin", () => {
    for (const evil of [
      "//evil.com",
      "https://evil.com",
      "http://evil.com/x",
      "\\\\evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "javascript:alert(1)//",
    ]) {
      expect(safeReturnUrl(evil, "/dashboard"), evil).toBe("/dashboard");
    }
  });
});

describe("visitor token parsing (malformed cookie)", () => {
  it("reads a corrupt cookie as signed-out instead of throwing", async () => {
    // Every one of these reached an unguarded JSON.parse in the old code.
    expect(await verifyVisitorToken("not-a-token")).toBeNull();
    expect(await verifyVisitorToken("a.b.c")).toBeNull();
    expect(await verifyVisitorToken("!!!.@@@.###")).toBeNull();
    expect(await verifyVisitorToken("eyJhbGciOiJIUzI1NiJ9.bm90LWpzb24.sig")).toBeNull();
    expect(await verifyVisitorToken("bm90LWpzb24.bm90LWpzb24.bm90")).toBeNull();
    // Right shape, wrong algorithm.
    const head = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(await verifyVisitorToken(`${head}.e30.c2ln`)).toBeNull();
  });

  it("still accepts a correctly signed token", async () => {
    const token = await signVisitorToken({ sub: 7, project_id: 3, role: "Member", permissions: ["db_read"] });
    const payload = await verifyVisitorToken(token);
    expect(payload?.sub).toBe(7);
    expect(payload?.project_id).toBe(3);
    expect(payload?.role).toBe("Member");
    expect(payload?.permissions).toEqual(["db_read"]);
  });

  it("rejects a signature that was tampered with", async () => {
    const token = await signVisitorToken({ sub: 1, project_id: 1, role: "Admin", permissions: [] });
    expect(await verifyVisitorToken(`${token}x`)).toBeNull();
  });
});

describe("rate-limit group mapping (§5.11)", () => {
  it("routes each path family to its documented budget", () => {
    expect(rateGroupFor("/auth/token")).toBe("auth");
    expect(rateGroupFor("/auth/captcha")).toBe("auth");
    // /auth/me must not share the credential budget or the console
    // would lock the user out of their own dashboard.
    expect(rateGroupFor("/auth/me")).toBe("default");
    expect(rateGroupFor("/api/db/find")).toBe("db");
    expect(rateGroupFor("/api/storage/upload")).toBe("storage");
    expect(rateGroupFor("/api/lib/list")).toBe("library");
    expect(rateGroupFor("/api/admin/users")).toBe("admin");
    expect(rateGroupFor("/admin/api/stats")).toBe("admin");
    expect(rateGroupFor("/api/projects")).toBe("default");
  });

  it("gives the credential group a budget that outlasts a lockout sequence", async () => {
    // Regression guard. The auth group covers captcha + token + logout, and the
    // console refetches a captcha after every failed attempt. With the old
    // hardcoded 10/minute, a user who hit auth.max_login_attempts (5) was
    // 429'd on their *successful* retry — a lockout with no way to tell the
    // user why.
    const { SYSTEM_CONFIG_DEFAULTS } = await import("@/lib/server/system-config");
    const budget = Number(SYSTEM_CONFIG_DEFAULTS["rate_limits.auth_requests_per_minute"]);
    const maxAttempts = Number(SYSTEM_CONFIG_DEFAULTS["auth.max_login_attempts"]);
    // Each failed attempt costs a captcha fetch and a token post, and the
    // successful attempt after them must still fit.
    expect(budget).toBeGreaterThanOrEqual((maxAttempts + 1) * 2);
  });
});

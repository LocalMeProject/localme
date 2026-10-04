/**
 * Middleware prefix invariants.
 *
 * `middleware.ts` decides what is a platform route in two independent places:
 * a `matcher` regex (which paths the middleware runs on at all) and
 * `RESERVED_PREFIXES` (which of those paths it then declines to rewrite). A
 * prefix added to one and not the other is not a compile error — it is a path
 * that quietly gets treated as `/{user}/{project}/` and 404s.
 *
 * `/fonts/*.woff2` was exactly that: parsed as user="fonts",
 * project="iransans-regular.woff2", rewritten to the serving route, so every
 * Persian page fell back to a system font without anything visibly failing.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { MATCHER_PATTERN, RESERVED_PREFIXES, middleware } from "@/middleware";

const PLATFORM_HOST = "localhost:3000";

function request(path: string): NextRequest {
  return new NextRequest(`http://${PLATFORM_HOST}${path}`);
}

/** Where the middleware sent the request, or null when it let it through. */
function destination(path: string): string | null {
  const response = middleware(request(path));
  const rewrite = response.headers.get("x-middleware-rewrite");
  if (rewrite) return rewrite;
  return response.headers.get("x-middleware-next") === "1" ? null : "unrecognised";
}

describe("serving middleware prefixes", () => {
  it("excludes every reserved prefix from the matcher regex", () => {
    for (const prefix of RESERVED_PREFIXES) {
      // Both the bare prefix and a path beneath it must be left alone.
      expect(MATCHER_PATTERN.test(prefix), `matcher must not run on ${prefix}`).toBe(false);
      expect(
        MATCHER_PATTERN.test(`${prefix}/something.woff2`),
        `matcher must not run on ${prefix}/something`,
      ).toBe(false);
    }
  });

  it("still routes tenant project paths through the serving rewrite", () => {
    expect(destination("/alice/portfolio")).toBe("http://localhost:3000/~serving/alice/portfolio");
    expect(destination("/alice/portfolio/index.html")).toBe(
      "http://localhost:3000/~serving/alice/portfolio/index.html",
    );
  });

  it("never rewrites the platform's own static assets", () => {
    // These are the paths that 404'd when `/fonts` was missing from the
    // reserved list: single-segment assets pass because `parseServingPath`
    // needs two segments, `/fonts/…` did not.
    for (const asset of [
      "/fonts/iransans-regular.woff2",
      "/fonts/vazir-variable.woff2",
      "/og.png",
      "/robots.txt",
      "/sitemap.xml",
      "/site.webmanifest",
    ]) {
      expect(destination(asset), `${asset} must not be rewritten`).toBeNull();
    }
  });

  it("leaves the landing page and other top-level routes alone", () => {
    for (const route of ["/", "/docs", "/auth", "/dashboard", "/skills/localme/SKILL.md", "/policy", "/profile"]) {
      expect(destination(route), `${route} must not be rewritten`).toBeNull();
    }
  });

  it("recognizes localme.ir as a platform host", () => {
    const req = new NextRequest("http://localme.ir/dashboard");
    const response = middleware(req);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("still refuses ACME challenges and honours custom domains", () => {
    expect(destination("/.well-known/acme-challenge/token")).toBeNull();

    const custom = new NextRequest("http://cakeshop.example/orders");
    const response = middleware(custom);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://cakeshop.example/~serving/_domain/cakeshop.example/orders",
    );
  });
});
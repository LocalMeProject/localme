/**
 * Project-serving tests (issue #6): route resolution, static file serving,
 * 404.html fallback, watermark injection, visit dedupe, and the free-visit
 * quota — against SQLite.
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "serving-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { brotliDecompressSync } from "node:zlib";
import { GET as servingRootRoute } from "@/app/~serving/[user]/[project]/route";
import { GET as servingPathRoute } from "@/app/~serving/[user]/[project]/[...path]/route";
import { getDb } from "@/lib/server/db/index";
import {
  checkVisitQuota,
  injectBaseHref,
  injectWatermark,
  parseServingPath,
  resolveProject,
  serveProjectRequest,
  type ResolvedProject,
} from "@/lib/server/serving";
import { createProject, createUser, putFile } from "@/lib/server/repos";
import { invalidateConfig } from "@/lib/server/system-config";
import { visitorAuthenticate } from "@/lib/server/visitor-auth";

let db: ReturnType<typeof getDb>;

/**
 * Mirror Next's own routing for the internal serving route: the project root
 * and the required catch-all are two exact-match routes (an optional catch-all
 * made Next answer with a redirect whose Location dropped the username), so the
 * tests dispatch the same way the router does.
 */
async function servingRoute(
  request: Request,
  context: { params: Promise<{ user: string; project: string; path?: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return path && path.length > 0
    ? servingPathRoute(request, context as never)
    : servingRootRoute(request, context as never);
}
let owner: { id: number };
let project: { id: number; name: string };

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  owner = await createUser("serveowner", "password123");
  project = await createProject(owner.id, "site");
  await putFile(owner.id, project.id, "index.html", Buffer.from("<html><body>Hello</body></html>"), false);
  await putFile(owner.id, project.id, "assets/app.css", Buffer.from("body{}"), false);
  await putFile(owner.id, project.id, "404.html", Buffer.from("<html><body>Custom 404</body></html>"), false);
  // Gated route: requires the project's visitor session (docs §5.5).
  await db.run(
    "INSERT INTO routes (project_id, path_pattern, target_file, requires_auth, is_active) VALUES (?, '/private', 'index.html', 1, 1)",
    [project.id],
  );
  // Role-gated route: only the "Editor" role may pass.
  await db.run(
    "INSERT INTO routes (project_id, path_pattern, target_file, requires_auth, required_role, is_active) VALUES (?, '/editor-only', 'index.html', 1, 'Editor', 1)",
    [project.id],
  );
  // Permission-gated routes (§5.5): the signed-in visitor's role must carry the
  // permission. The default Member role has analytics_read but not secrets_admin.
  await db.run(
    "INSERT INTO routes (project_id, path_pattern, target_file, required_permission, is_active) VALUES (?, '/reports', 'index.html', 'analytics_read', 1)",
    [project.id],
  );
  await db.run(
    "INSERT INTO routes (project_id, path_pattern, target_file, required_permission, is_active) VALUES (?, '/secrets-admin', 'index.html', 'secrets_admin', 1)",
    [project.id],
  );
}, 30_000);

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${path}`, { headers });
}

describe("parseServingPath", () => {
  it("splits user/project/path", () => {
    expect(parseServingPath("/alice/site/docs/index.html")).toEqual({
      user: "alice",
      project: "site",
      path: "/docs/index.html",
    });
  });

  it("returns null for reserved prefixes and short paths", () => {
    expect(parseServingPath("/")).toBeNull();
    expect(parseServingPath("/dashboard")).toBeNull();
    expect(parseServingPath("/api/db/find")).toBeNull();
    expect(parseServingPath("/_next/static/x.js")).toBeNull();
    expect(parseServingPath("/onlyuser")).toBeNull();
  });
});

describe("serveProjectRequest", () => {
  it("serves index.html with the watermark injected", async () => {
    const response = await serveProjectRequest(get("/serveowner/site/"), {
      user: "serveowner",
      project: "site",
      path: "/",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Hello");
    expect(html).toContain("MVP Platform");
    expect(html.indexOf("MVP Platform")).toBeGreaterThan(html.indexOf("</body>") - 200);
  });

  it("serves static assets with correct content type and no watermark", async () => {
    const response = await serveProjectRequest(get("/serveowner/site/assets/app.css"), {
      user: "serveowner",
      project: "site",
      path: "/assets/app.css",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toBe("body{}");
  });

  it("falls back to the project 404.html with status 404", async () => {
    const response = await serveProjectRequest(get("/serveowner/site/missing/page.html"), {
      user: "serveowner",
      project: "site",
      path: "/missing/page.html",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Custom 404");
  });

  it("returns the platform 404 for unknown projects", async () => {
    const response = await serveProjectRequest(get("/nobody/nope/"), {
      user: "nobody",
      project: "nope",
      path: "/",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Unknown project");
  });

  it("redirects unauthenticated visitors on requires_auth routes", async () => {
    const response = await serveProjectRequest(get("/serveowner/site/private"), {
      user: "serveowner",
      project: "site",
      path: "/private",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/auth/login?");
    expect(response.headers.get("location")).toContain("returnUrl=%2Fserveowner%2Fsite%2Fprivate");
  });

  it("serves requires_auth routes with a valid visitor cookie", async () => {
    const token = await visitorAuthenticate({
      projectId: project.id,
      action: "signup",
      username: "visitor-one",
      password: "visitor-pass-1",
    });
    const response = await serveProjectRequest(
      get("/serveowner/site/private", { cookie: `auth_${project.id}=${token}` }),
      { user: "serveowner", project: "site", path: "/private" },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hello");
  });

  it("rejects visitors without the required role", async () => {
    const token = await visitorAuthenticate({
      projectId: project.id,
      action: "login",
      username: "visitor-one",
      password: "visitor-pass-1",
    });
    const response = await serveProjectRequest(
      get("/serveowner/site/editor-only", { cookie: `auth_${project.id}=${token}` }),
      { user: "serveowner", project: "site", path: "/editor-only" },
    );
    expect(response.status).toBe(403);
  });

  it("enforces a route's required_permission from the visitor's role", async () => {
    // A permission requirement implies the auth gate, even with requires_auth off.
    const anonymous = await serveProjectRequest(get("/serveowner/site/reports"), {
      user: "serveowner",
      project: "site",
      path: "/reports",
    });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toContain("/auth/login?");

    const token = await visitorAuthenticate({
      projectId: project.id,
      action: "signup",
      username: "perm-visitor",
      password: "visitor-pass-1",
    });
    const cookie = { cookie: `auth_${project.id}=${token}` };

    // Member carries analytics_read → served.
    const allowed = await serveProjectRequest(get("/serveowner/site/reports", cookie), {
      user: "serveowner",
      project: "site",
      path: "/reports",
    });
    expect(allowed.status).toBe(200);

    // Member lacks secrets_admin → 403 naming the missing permission.
    const denied = await serveProjectRequest(get("/serveowner/site/secrets-admin", cookie), {
      user: "serveowner",
      project: "site",
      path: "/secrets-admin",
    });
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain("secrets_admin");
  });

  it("honours the serving.hotlink_protection switch", async () => {
    const evil = { referer: "https://evil.example/steal" };
    const target = { user: "serveowner", project: "site", path: "/assets/app.css" };

    // Default (§7.8): a foreign referer is refused.
    expect((await serveProjectRequest(get("/serveowner/site/assets/app.css", evil), target)).status).toBe(403);

    await db.run(
      "INSERT INTO system_configs (config_key, config_value) VALUES ('serving.hotlink_protection', 'false') ON CONFLICT (config_key) DO UPDATE SET config_value = 'false'",
    );
    invalidateConfig();
    try {
      const response = await serveProjectRequest(get("/serveowner/site/assets/app.css", evil), target);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("body{}");
    } finally {
      await db.run(
        "INSERT INTO system_configs (config_key, config_value) VALUES ('serving.hotlink_protection', 'true') ON CONFLICT (config_key) DO UPDATE SET config_value = 'true'",
      );
      invalidateConfig();
    }
    expect((await serveProjectRequest(get("/serveowner/site/assets/app.css", evil), target)).status).toBe(403);
  });

  it("forwards is_proxy routes to the configured upstream", async () => {
    const upstream = await listenOnce("proxied-upstream-body");
    try {
      await db.run(
        "INSERT INTO routes (project_id, path_pattern, is_proxy, proxy_config, is_active) VALUES (?, '/gateway', 1, ?, 1)",
        [project.id, JSON.stringify({ target: upstream.url })],
      );
      const response = await serveProjectRequest(get("/serveowner/site/gateway/data"), {
        user: "serveowner",
        project: "site",
        path: "/gateway/data",
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("proxied-upstream-body");
    } finally {
      upstream.server.close();
    }
  });
});

/** Tiny one-response HTTP server for proxy tests. */
function listenOnce(body: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

describe("visits", () => {
  it("logs a visit once, dedupes within the window", async () => {
    const target = { user: "serveowner", project: "site", path: "/" };
    await serveProjectRequest(get("/serveowner/site/", { "user-agent": "ua-1", "x-forwarded-for": "9.9.9.9" }), target);
    await serveProjectRequest(get("/serveowner/site/", { "user-agent": "ua-1", "x-forwarded-for": "9.9.9.9" }), target);

    const rows = await db.raw<{ n: number }>(
      "SELECT COUNT(*) AS n FROM visit_logs WHERE ip = '9.9.9.9'",
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it("marks is_unique only for a route/ip pair's first visit of the day", async () => {
    // Pre-existing visit from 5.5.5.5 earlier today (outside the 5-minute
    // dedupe window, inside the day window) → today's visit is not unique.
    // Anchored to one second after UTC midnight rather than "two hours ago":
    // the uniqueness window is the UTC calendar day, so a relative offset
    // silently lands on the previous day when the suite runs before 02:00.
    const earlierToday = new Date();
    earlierToday.setUTCHours(0, 0, 1, 0);
    await db.run(
      "INSERT INTO visit_logs (project_id, route, ip, visited_at) VALUES (?, 'index.html', '5.5.5.5', ?)",
      [project.id, earlierToday.toISOString()],
    );
    const target = { user: "serveowner", project: "site", path: "/" };
    await serveProjectRequest(get("/serveowner/site/", { "x-forwarded-for": "5.5.5.5" }), target);
    await serveProjectRequest(get("/serveowner/site/", { "x-forwarded-for": "6.6.6.6" }), target);

    const rows = await db.raw<{ ip: string; is_unique: number }>(
      "SELECT ip, is_unique FROM visit_logs WHERE route = 'index.html' AND ip IN ('5.5.5.5', '6.6.6.6')",
    );
    const byIp = new Map(rows.map((row) => [row.ip, Number(row.is_unique)]));
    expect(byIp.get("5.5.5.5")).toBe(0);
    expect(byIp.get("6.6.6.6")).toBe(1);
  });

  it("enforces the free-visit quota with 402", async () => {
    const resolved = (await resolveProject("serveowner", "site")) as ResolvedProject;
    // Fill the month's quota.
    for (let i = 0; i < resolved.freeVisitsPerMonth; i++) {
      await db.run(
        "INSERT INTO visit_logs (project_id, route, ip, visited_at) VALUES (?, 'quota', ?, ?)",
        [project.id, `quota-ip-${i}`, new Date().toISOString()],
      );
    }
    await expect(checkVisitQuota(resolved)).rejects.toMatchObject({ code: "payment_required" });
  });
});

describe("watermark", () => {
  it("injects before </body> and is idempotent-safe", () => {
    const html = injectWatermark("<html><body>x</body></html>");
    expect(html).toMatch(/MVP Platform<\/a><\/div><\/body>/i);
    expect(injectWatermark("<html><head></head></html>").endsWith("MVP Platform</div>") ||
      injectWatermark("<html><head></head></html>").includes("MVP Platform")).toBe(true);
  });
});

describe("serving route handler (§5.6/§5.7 contract)", () => {
  // These exercise the route module itself, not serveProjectRequest(): the
  // bugs they cover — a 402 escaping as a 500, and a proxy mount rejecting
  // every verb but GET — only exist at that layer.
  const ctx = { params: Promise.resolve({ user: "serveowner", project: "site", path: [] }) };

  it("answers 402, not 500, when the project is over its visit quota", async () => {
    const capped = await createUser("quotaowner", "password123");
    const cappedProject = await createProject(capped.id, "quotaapp");
    await db.run(
      "UPDATE projects SET free_visits_per_month = 1 WHERE id = ?",
      [cappedProject.id],
    );
    await putFile(capped.id, cappedProject.id, "index.html", Buffer.from("<html><body>q</body></html>"));
    await db.run(
      "INSERT INTO visit_logs (project_id, route, ip, visited_at) VALUES (?, 'index.html', '7.7.7.7', ?)",
      [cappedProject.id, new Date().toISOString()],
    );

    const response = await servingRoute(
      new Request("https://app.test/quotaowner/quotaapp/", { headers: { "x-forwarded-for": "8.8.8.8" } }),
      { params: Promise.resolve({ user: "quotaowner", project: "quotaapp", path: [] }) },
    );
    expect(response.status).toBe(402);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("payment_required");
    void ctx;
  });

  it("forwards a POST through a proxy mount, not just GET", async () => {
    const upstream = await new Promise<{ server: Server; url: string; seen: string[] }>((resolve) => {
      const seen: string[] = [];
      const server = createServer((req, res) => {
        seen.push(`${req.method} ${req.url}`);
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("upstream-ok");
      });
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        resolve({ server, url: `http://127.0.0.1:${port}/`, seen });
      });
    });
    try {
      await db.run(
        "INSERT INTO routes (project_id, path_pattern, is_proxy, proxy_config, is_active) VALUES (?, '/pay', 1, ?, 1)",
        [project.id, JSON.stringify({ target: upstream.url })],
      );
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const response = await servingRoute(
          new Request("https://app.test/serveowner/site/pay", {
            method,
            headers: { "content-type": "application/json", "x-forwarded-for": "4.4.4.4" },
            body: method === "GET" ? undefined : "{}",
          }),
          { params: Promise.resolve({ user: "serveowner", project: "site", path: ["pay"] }) },
        );
        expect(response.status, method).toBe(200);
        expect(await response.text(), method).toBe("upstream-ok");
      }
      expect(upstream.seen).toEqual(["POST /", "PUT /", "PATCH /", "DELETE /"]);
    } finally {
      upstream.server.close();
    }
  });

  it("rejects a verb the platform does not serve with 405", async () => {
    // "TRACE" is forbidden by the fetch spec, so use an arbitrary verb.
    const response = await servingRoute(
      new Request("https://app.test/serveowner/site/", { method: "FOOBAR" }),
      ctx,
    );
    expect(response.status).toBe(405);
  });

  it("compresses HTML like every other text response", async () => {
    // A fresh project: the shared fixture's monthly quota is spent by the
    // tests above.
    const fresh = await createProject(owner.id, "compressible");
    await putFile(owner.id, fresh.id, "big.html", Buffer.from(`<html><body>${"x".repeat(4000)}</body></html>`));
    const response = await serveProjectRequest(
      get("/serveowner/compressible/big.html", { "accept-encoding": "br, gzip" }),
      { user: "serveowner", project: "compressible", path: "/big.html" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("br");
    // no-store is for freshness, not for staying uncompressed.
    expect(response.headers.get("cache-control")).toBe("no-store");
    const raw = Buffer.from(await response.arrayBuffer());
    expect(brotliDecompressSync(raw).toString("utf8")).toContain("<html><head>");
  });
});

describe("relative asset references resolve under the project root", () => {
  it("serves the target a \"/\" route is bound to instead of 404ing", async () => {
    // The console defaults the new-route form to "/" → "index.html", and the
    // report was that saving it and opening the project still 404'd.
    const host = await createUser("rootowner", "password123");
    const site = await createProject(host.id, "routed-root");
    await putFile(host.id, site.id, "home.html", Buffer.from("<html><body>root route</body></html>"));
    // createProject seeds a "/" route bound to index.html, which does not exist
    // here — the console edit is an upsert, not an insert.
    await db.run(
      "UPDATE routes SET target_file = 'home.html', is_active = 1 WHERE project_id = ? AND path_pattern = '/'",
      [site.id],
    );

    for (const path of ["/", ""]) {
      const response = await serveProjectRequest(get(`/rootowner/routed-root${path}`), {
        user: "rootowner",
        project: "routed-root",
        path: path || "/",
      });
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain("root route");
    }

    // With the route inactive the project falls back to the scaffold index.html,
    // proving the 200 above came from the route target and not a coincidence.
    await db.run("UPDATE routes SET is_active = 0 WHERE project_id = ? AND path_pattern = '/'", [site.id]);
    const bare = await serveProjectRequest(get("/rootowner/routed-root/"), {
      user: "rootowner",
      project: "routed-root",
      path: "/",
    });
    expect(bare.status).toBe(200);
    expect(await bare.text()).not.toContain("root route");
  });
  it("pins the base URL so /static/app.js resolves to /{user}/{project}/static/app.js", async () => {
    const host = await createUser("assetowner", "password123");
    const hosted = await createProject(host.id, "field-notes");
    // The page uses a *relative* reference, which is what every editor
    // template emits and what broke when the document URL had no trailing
    // slash or sat behind a route.
    await putFile(
      host.id,
      hosted.id,
      "index.html",
      Buffer.from(
        '<html><head><title>t</title></head><body><script src="static/app.js"></script></body></html>',
      ),
    );
    await putFile(host.id, hosted.id, "static/app.js", Buffer.from("window.LOCALME_PROJECT_ID = 7;"));

    const page = await serveProjectRequest(get("/assetowner/field-notes/"), {
      user: "assetowner",
      project: "field-notes",
      path: "/",
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<base href="/assetowner/field-notes/">');

    // And the asset the browser will now ask for really is served.
    const asset = await serveProjectRequest(get("/assetowner/field-notes/static/app.js"), {
      user: "assetowner",
      project: "field-notes",
      path: "/static/app.js",
    });
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("LOCALME_PROJECT_ID");
  });

  it("pins the base URL from a nested route too, not just the project root", async () => {
    // /deep/page is routed to page.html; without a base the browser would look
    // for the script at /assetowner/routed/deep/static/app.js.
    const host = await createUser("routeowner", "password123");
    const routed = await createProject(host.id, "routed");
    await putFile(
      host.id,
      routed.id,
      "page.html",
      Buffer.from('<html><head></head><body><img src="static/logo.svg"></body></html>'),
    );
    await db.run(
      "INSERT INTO routes (project_id, path_pattern, target_file, is_active) VALUES (?, '/deep/page', 'page.html', 1)",
      [routed.id],
    );

    const response = await serveProjectRequest(get("/routeowner/routed/deep/page"), {
      user: "routeowner",
      project: "routed",
      path: "/deep/page",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<base href="/routeowner/routed/">');
  });

  it("adds the base URL to the project's own 404 page too", async () => {
    const host = await createUser("nfowner", "password123");
    const notFound = await createProject(host.id, "notfound");
    await putFile(host.id, notFound.id, "404.html", Buffer.from("<html><body>lost</body></html>"));
    const response = await serveProjectRequest(get("/nfowner/notfound/nowhere"), {
      user: "nfowner",
      project: "notfound",
      path: "/nowhere",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<base href="/nfowner/notfound/">');
  });

  it("never overrides a base the author declared themselves", () => {
    expect(injectBaseHref('<html><head><base href="/custom/"></head></html>', "/u/p/")).toBe(
      '<html><head><base href="/custom/"></head></html>',
    );
  });

  it("creates a head when the page has none", () => {
    expect(injectBaseHref("<html><body>x</body></html>", "/u/p/")).toContain(
      '<html><head><base href="/u/p/"></head>',
    );
  });
});

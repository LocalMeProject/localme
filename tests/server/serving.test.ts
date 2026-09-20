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
import { getDb } from "@/lib/server/db/index";
import {
  checkVisitQuota,
  injectWatermark,
  parseServingPath,
  resolveProject,
  serveProjectRequest,
  type ResolvedProject,
} from "@/lib/server/serving";
import { createProject, createUser, putFile } from "@/lib/server/repos";
import { visitorAuthenticate } from "@/lib/server/visitor-auth";

let db: ReturnType<typeof getDb>;
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
    // Pre-existing visit from 5.5.5.5 yesterday → today's visit is not unique.
    await db.run(
      "INSERT INTO visit_logs (project_id, route, ip, visited_at) VALUES (?, '/dedupe', '5.5.5.5', ?)",
      [project.id, new Date(Date.now() - 26 * 3600 * 1000).toISOString()],
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
    expect(html).toMatch(/MVP Platform<\/div><\/body>/i);
    expect(injectWatermark("<html><head></head></html>").endsWith("MVP Platform</div>") ||
      injectWatermark("<html><head></head></html>").includes("MVP Platform")).toBe(true);
  });
});

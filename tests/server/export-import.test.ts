/**
 * Unit and integration tests for export and import services:
 * - lib/server/export/common.ts
 * - lib/server/export/export-feature.ts
 * - lib/server/export/import-feature.ts
 * - lib/server/export/archive.ts
 * - lib/server/export/handlers.ts
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "export-import-test-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "export-test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "export-test-encryption-key-32-b!";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "localme_session" && sessionCookie ? { value: sessionCookie } : undefined,
    }),
}));

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/server/db/index";
import {
  createProject,
  createUser,
  ensureLibraryProject,
  getFileBlob,
  putFile,
} from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import { buildZip, readZip } from "@/lib/server/zip";
import {
  EXPORT_FEATURES,
  exportAllHandler,
  exportFeature,
  exportFeatureHandler,
  featureFromParam,
  importAllHandler,
  importFeature,
  importFeatureHandler,
} from "@/lib/server/export-routes";

let db: ReturnType<typeof getDb>;
let user: { id: number; username: string };
let project: { id: number; name: string };
let userCookie: string;

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  user = await createUser("exportuser", "Password123!");
  project = await createProject(user.id, "exportproj");
  userCookie = await createSession(user.id);
  sessionCookie = userCookie;

  // Add some test fixtures
  await putFile(user.id, project.id, "index.html", Buffer.from("<h1>Hello</h1>"), false);
  await db.run(
    `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, requires_auth, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [project.id, "/home", "index.html", 0, 0, 1],
  );
  await db.run(
    `INSERT INTO api_endpoints (project_id, endpoint_name, is_enabled, requires_auth)
     VALUES (?, ?, ?, ?)`,
    [project.id, "ping", 1, 0],
  );
  await db.run(
    `INSERT INTO webhooks (project_id, url, events, is_active, secret)
     VALUES (?, ?, ?, ?, ?)`,
    [project.id, "https://example.com/webhook", '["storage.uploaded"]', 1, "whsec_test"],
  );
  await db.run(
    `INSERT INTO domains (project_id, domain, verification_token, is_verified)
     VALUES (?, ?, ?, ?)`,
    [project.id, "custom.example.com", "verify_token", 1],
  );
});

afterAll(() => {
  db.close?.();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

describe("Feature parameter resolution and validation", () => {
  it("resolves valid features and rejects invalid ones", () => {
    for (const f of EXPORT_FEATURES) {
      expect(featureFromParam(f)).toBe(f);
    }
    expect(() => featureFromParam("unknown_feature")).toThrow();
  });
});

describe("Exporting features individually", () => {
  it("exports each supported feature accurately", async () => {
    for (const feature of EXPORT_FEATURES) {
      const data = await exportFeature(project.id, feature);
      expect(data).toBeDefined();
    }

    const routes = (await exportFeature(project.id, "routes")) as Array<any>;
    expect(routes.some((r) => r.pathPattern === "/home")).toBe(true);

    const api = (await exportFeature(project.id, "api")) as Array<any>;
    expect(api.some((e) => e.endpoint === "ping")).toBe(true);

    const webhooks = (await exportFeature(project.id, "webhooks")) as Array<any>;
    expect(webhooks.some((w) => w.url === "https://example.com/webhook")).toBe(true);

    const dns = (await exportFeature(project.id, "dns")) as Array<any>;
    expect(dns.some((d) => d.domain === "custom.example.com")).toBe(true);
  });

  it("handles exportFeatureHandler via HTTP", async () => {
    sessionCookie = userCookie;
    const req = new Request(`https://app.test/api/export/routes?projectId=${project.id}`);
    const res = await exportFeatureHandler(req, { params: Promise.resolve({ feature: "routes" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.feature).toBe("routes");
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Importing features individually", () => {
  it("imports and overwrites features cleanly", async () => {
    // 1. Roles
    const rolesRes = await importFeature(project.id, "roles", [
      { name: "Support", permissions: ["db_read"] },
    ]);
    expect(rolesRes.imported).toBe(1);
    const exportedRoles = (await exportFeature(project.id, "roles")) as Array<any>;
    expect(exportedRoles.some((r) => r.name === "Support")).toBe(true);

    // 2. Cron
    const cronRes = await importFeature(project.id, "cron", [
      { task: "heartbeat", isEnabled: true, parameters: {} },
    ]);
    expect(cronRes.imported).toBe(1);

    // 3. Secrets
    const secRes = await importFeature(project.id, "secrets", [
      { key: "DB_PASS", value: "secret123" },
    ]);
    expect(secRes.imported).toBe(1);

    // 4. Auth (visitors)
    const authRes = await importFeature(project.id, "auth", {
      visitors: [{ username: "support_user", role: "Support", isActive: true }],
    });
    expect(authRes.imported).toBe(1);
    const exportedAuth = (await exportFeature(project.id, "auth")) as { visitors: any[] };
    expect(exportedAuth.visitors.some((v) => v.username === "support_user")).toBe(true);
  });

  it("handles importFeatureHandler via HTTP", async () => {
    sessionCookie = userCookie;
    const req = new Request(`https://app.test/api/import/api?projectId=${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ endpoint: "status", isEnabled: true, requiresAuth: false }]),
    });
    const res = await importFeatureHandler(req, { params: Promise.resolve({ feature: "api" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.imported).toBe(1);
  });
});

describe("Full project ZIP export and import", () => {
  it("builds a full project export ZIP and serves it via exportAllHandler", async () => {
    sessionCookie = userCookie;
    const req = new Request(`https://app.test/api/export/all?projectId=${project.id}`);
    const res = await exportAllHandler(req);
    expect(res.status).toBe(200);
    const blob = await res.arrayBuffer();
    const entries = readZip(Buffer.from(blob));
    const paths = entries.map((e) => e.path);

    expect(paths).toContain("storage/index.html");
    expect(paths).toContain("config/config.json");
    expect(paths).toContain("config/secrets.json");
    expect(paths).toContain("README.txt");
  });

  it("imports archive and handles library conflicts with overwrite, append, skip modes", async () => {
    sessionCookie = userCookie;
    const libraryProject = await ensureLibraryProject(user.id);

    // Populate the library first
    await putFile(user.id, libraryProject.id, "shared.css", Buffer.from("body { color: red; }"), true);

    // Create an archive containing both storage and library files
    const archive = buildZip([
      { path: "storage/page2.html", content: Buffer.from("<h2>Page 2</h2>") },
      { path: "library/shared.css", content: Buffer.from("body { color: blue; }") },
      { path: "library/extra.js", content: Buffer.from("console.log('extra');") },
      { path: "config/config.json", content: Buffer.from(JSON.stringify({
        routes: [{ pathPattern: "/page2", targetFile: "page2.html", isProxy: false, requiresAuth: false, isActive: true }]
      })) },
    ]);

    // 1. Importing without libraryMode when library is already populated triggers 409 conflict
    const conflictRes = await importAllHandler(
      new Request(`https://app.test/api/import/all?projectId=${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: new Uint8Array(archive),
      }),
    );
    expect(conflictRes.status).toBe(409);
    const conflictJson = await conflictRes.json();
    expect(conflictJson.conflict).toBe("library_populated");

    // 2. Importing with libraryMode=skip ignores library files
    const skipRes = await importAllHandler(
      new Request(`https://app.test/api/import/all?projectId=${project.id}&libraryMode=skip`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: new Uint8Array(archive),
      }),
    );
    expect(skipRes.status).toBe(200);
    const skipJson = await skipRes.json();
    expect(skipJson.files).toBeGreaterThanOrEqual(1);
    // original shared.css in library should still have color: red
    const libBlob = await getFileBlob(libraryProject.id, "shared.css");
    expect(libBlob!.content.toString("utf8")).toBe("body { color: red; }");

    // 3. Importing with libraryMode=overwrite replaces library assets completely
    const overwriteRes = await importAllHandler(
      new Request(`https://app.test/api/import/all?projectId=${project.id}&libraryMode=overwrite`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: new Uint8Array(archive),
      }),
    );
    expect(overwriteRes.status).toBe(200);
    const overwriteBlob = await getFileBlob(libraryProject.id, "shared.css");
    expect(overwriteBlob!.content.toString("utf8")).toBe("body { color: blue; }");
    const extraBlob = await getFileBlob(libraryProject.id, "extra.js");
    expect(extraBlob).not.toBeNull();
  });

  it("rejects malicious or corrupted archives", async () => {
    sessionCookie = userCookie;

    // Path traversal attempt
    const evilZip = buildZip([
      { path: "storage/../../evil.sh", content: Buffer.from("echo pwned") },
    ]);
    const traversalRes = await importAllHandler(
      new Request(`https://app.test/api/import/all?projectId=${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: new Uint8Array(evilZip),
      }),
    );
    expect(traversalRes.status).toBe(200);
    const traversalJson = await traversalRes.json();
    expect(traversalJson.skipped).toBeGreaterThanOrEqual(1);

    // Corrupt zip
    const corruptRes = await importAllHandler(
      new Request(`https://app.test/api/import/all?projectId=${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: Buffer.from("not a valid zip file"),
      }),
    );
    expect(corruptRes.status).toBe(400);
  });
});

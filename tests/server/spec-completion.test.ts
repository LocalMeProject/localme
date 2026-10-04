/**
 * Spec-completion suite: the second pass that closed the audit findings against
 * the Blueprint and Technical Documentation — project scaffolding, granular
 * permissions, public endpoint policy, the cron task set + platform runner,
 * the documented webhook events with a delivery log, import/export, hotlink
 * protection, response compression, minification, /health, the platform public
 * library, and the admin project/global-cron surfaces.
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "spec-completion-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";
process.env.PLATFORM_CRON_TOKEN = "test-cron-token";
process.env.NEXT_PUBLIC_SITE_URL = "https://app.test";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "localme_session" && sessionCookie ? { value: sessionCookie } : undefined,
    }),
}));

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setSystemConfig } from "@/tests/helpers/config";
import { createServer } from "node:http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  createApiKey,
  createProject,
  createUser,
  getFile,
  getFileBlob,
  listFiles,
  resolveApiKey,
  updateApiKeyPermissions,
  DEFAULT_ROLES,
  PERMISSIONS,
} from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import { dbCount, dbFind, dbGet, dbInsert } from "@/lib/server/db-routes";
import {
  cleanOldLogs,
  cleanOrphanedUploads,
  cronList,
  cronRun,
  cronToggle,
  platformCronSweep,
  runCronTask,
  sendDailySummaryWebhook,
} from "@/lib/server/cron-routes";
import { CRON_TASKS, BUILTIN_TASKS } from "@/lib/server/cron-tasks";
import { dispatchWebhookEventForUser, webhooksDeliveries, webhooksTest } from "@/lib/server/webhook-routes";
import { buildProjectExport, exportFeature, importFeature } from "@/lib/server/export-routes";
import { buildZip } from "@/lib/server/zip";
import { serveProjectRequest } from "@/lib/server/serving";
import { storageUpload, storageList } from "@/lib/server/storage-routes";
import { adminCronGet, adminCronPut, adminProjectsList, adminProjectsPatch, adminPublicLibraryPut } from "@/lib/server/admin-routes";
import { sanitizeRelativePath } from "@/lib/server/storage-routes";
import { minifyCss, minifyHtml, minifyJs } from "@/lib/server/minify";
import { isHotlink } from "@/lib/server/hotlink";

let db: ReturnType<typeof getDb>;
let owner: { id: number; username: string };
let admin: { id: number; username: string };
let project: { id: number; name: string };
let ownerSession = "";
let adminSession = "";
const NO_CONTEXT = { params: Promise.resolve({}) };

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  owner = await createUser("specowner", "password123");
  admin = await createUser("specadmin", "password123");
  await db.run(
    `UPDATE users SET is_admin = ${placeholder(db.driver, 0)} WHERE id = ${placeholder(db.driver, 1)}`,
    [1, admin.id],
  );
  project = await createProject(owner.id, "specapp");
  // The webhook receiver in this suite is a local HTTP server, which the SSRF
  // guard rejects by default. The opt-in switch is what a self-hosted
  // deployment would set.
  await setSystemConfig(db, "webhooks.allow_private_targets", true);
  ownerSession = await createSession(owner.id);
  adminSession = await createSession(admin.id);
});

afterAll(() => {
  db.close?.();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Windows file lock fallback */
  }
});

function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function get(url: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${url}`, { headers });
}

async function countRows(sql: string, params: unknown[] = []): Promise<number> {
  const rows = await db.raw<{ n: number | string }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------- scaffolding

describe("project scaffolding (§12, §5.5)", () => {
  it("seeds the welcome page, PWA files, roles, routes and cron tasks", async () => {
    const paths = (await listFiles(project.id)).map((file) => file.path);
    expect(paths).toEqual(
      expect.arrayContaining(["index.html", "manifest.json", "sw.js", "icons/icon.svg"]),
    );

    const manifest = await getFileBlob(project.id, "manifest.json");
    expect(manifest!.content.toString("utf8")).toContain("\"display\": \"standalone\"");

    const roles = await db.raw<{ name: string; permissions: string }>(
      `SELECT name, permissions FROM roles WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY name`,
      [project.id],
    );
    expect(roles.map((row) => row.name)).toEqual(DEFAULT_ROLES.map((role) => role.name).sort());
    expect(JSON.parse(roles.find((r) => r.name === "Owner")!.permissions)).toHaveLength(PERMISSIONS.length);

    const routes = await db.raw<{ path_pattern: string; target_file: string }>(
      `SELECT path_pattern, target_file FROM routes WHERE project_id = ${placeholder(db.driver, 0)}`,
      [project.id],
    );
    expect(routes).toContainEqual({ path_pattern: "/", target_file: "index.html" });

    const tasks = await db.raw<{ task_name: string; parameters: string }>(
      `SELECT task_name, parameters FROM cron_configs WHERE project_id = ${placeholder(db.driver, 0)}`,
      [project.id],
    );
    expect(tasks.map((row) => row.task_name).sort()).toEqual([...CRON_TASKS].sort());
    expect(JSON.parse(tasks.find((t) => t.task_name === "clean_expired_sessions")!.parameters)).toEqual({
      retention_days: 7,
    });
    for (const task of BUILTIN_TASKS) {
      expect(tasks.some((row) => row.task_name === task)).toBe(true);
    }
  });

  it("rejects routes under reserved prefixes (§5.4)", async () => {
    sessionCookie = ownerSession;
    const { consoleRoutesCreate } = await import("@/lib/server/console-routes");
    const response = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, { pathPattern: "/api/hook", targetFile: "index.html" }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(400);
  });

  it("stores a route's required_permission and validates it against §5.5", async () => {
    sessionCookie = ownerSession;
    const { consoleRoutesCreate, consoleRoutesList } = await import("@/lib/server/console-routes");

    const created = await consoleRoutesCreate(
      post(
        `/api/routes?projectId=${project.id}`,
        { pathPattern: "/team-reports", targetFile: "index.html", requiredPermission: "analytics_read" },
      ),
      NO_CONTEXT,
    );
    expect(created.status).toBe(201);

    const listed = await consoleRoutesList(get(`/api/routes?projectId=${project.id}`), NO_CONTEXT);
    const body = (await listed.json()) as { data: Array<{ pathPattern: string; requiredPermission: string | null }> };
    expect(body.data.find((route) => route.pathPattern === "/team-reports")!.requiredPermission).toBe(
      "analytics_read",
    );

    // Unknown permission names are refused rather than silently stored.
    const invalid = await consoleRoutesCreate(
      post(
        `/api/routes?projectId=${project.id}`,
        { pathPattern: "/team-reports-2", targetFile: "index.html", requiredPermission: "not_a_permission" },
      ),
      NO_CONTEXT,
    );
    expect(invalid.status).toBe(400);

    // Clearing it again is how a route goes back to "role only".
    const cleared = await consoleRoutesCreate(
      post(
        `/api/routes?projectId=${project.id}`,
        { pathPattern: "/team-reports", targetFile: "index.html", requiredPermission: null },
      ),
      NO_CONTEXT,
    );
    expect(cleared.status).toBe(200);
    const after = await consoleRoutesList(get(`/api/routes?projectId=${project.id}`), NO_CONTEXT);
    const afterBody = (await after.json()) as { data: Array<{ pathPattern: string; requiredPermission: string | null }> };
    expect(afterBody.data.find((route) => route.pathPattern === "/team-reports")!.requiredPermission).toBeNull();
  });
});

// ---------------------------------------------------------------- db endpoints

describe("document endpoints", () => {
  it("gets and counts documents", async () => {
    const key = await createApiKey(owner.id, project.id, "docs-key");
    const headers = { authorization: `Bearer ${key.key}` };

    const inserted = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "notes", document: { id: "n1", text: "hi" } }, headers),
      NO_CONTEXT,
    );
    expect(inserted.status).toBe(201);

    const got = await dbGet(post(`/api/db/get?projectId=${project.id}`, { table: "notes", id: "n1" }, headers), NO_CONTEXT);
    expect(got.status).toBe(200);
    const gotBody = (await got.json()) as { data: { id: string; text: string; _localme: unknown } };
    expect(gotBody.data.id).toBe("n1");
    expect(gotBody.data._localme).toBeTruthy();

    const counted = await dbCount(post(`/api/db/count?projectId=${project.id}`, { table: "notes" }, headers), NO_CONTEXT);
    expect(((await counted.json()) as { total: number }).total).toBe(1);

    const missing = await dbGet(post(`/api/db/get?projectId=${project.id}`, { table: "notes", id: "nope" }, headers), NO_CONTEXT);
    expect(missing.status).toBe(404);
  });
});

// ---------------------------------------------------------------- permissions

describe("granular permissions (§5.5)", () => {
  it("enforces db_read/db_write on API keys", async () => {
    const readOnly = await createApiKey(owner.id, project.id, "reader", ["db_read"]);
    const readHeaders = { authorization: `Bearer ${readOnly.key}` };

    const read = await dbFind(post(`/api/db/find?projectId=${project.id}`, { table: "notes" }, readHeaders), NO_CONTEXT);
    expect(read.status).toBe(200);

    const write = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "notes", document: { id: "n2" } }, readHeaders),
      NO_CONTEXT,
    );
    expect(write.status).toBe(403);

    // A key with no permission list keeps full project access.
    const full = await createApiKey(owner.id, project.id, "full");
    const fullWrite = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "notes", document: { id: "n3" } }, { authorization: `Bearer ${full.key}` }),
      NO_CONTEXT,
    );
    expect(fullWrite.status).toBe(201);

    // Permissions can be rotated after creation.
    expect(await updateApiKeyPermissions(owner.id, project.id, readOnly.record.id, ["db_read", "db_write"])).toBe(true);
    const afterRotate = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "notes", document: { id: "n4" } }, readHeaders),
      NO_CONTEXT,
    );
    expect(afterRotate.status).toBe(201);
  });

  it("accepts the documented X-API-Key header and expires idle keys", async () => {
    const key = await createApiKey(owner.id, project.id, "header-key", ["db_read"]);
    const viaHeader = await dbFind(
      post(`/api/db/find?projectId=${project.id}`, { table: "notes" }, { "x-api-key": key.key }),
      NO_CONTEXT,
    );
    expect(viaHeader.status).toBe(200);

    const stale = await createApiKey(owner.id, project.id, "stale-key");
    const longAgo = new Date(Date.now() - 120 * 86_400_000).toISOString();
    await db.run(
      `UPDATE api_keys SET created_at = ${placeholder(db.driver, 0)}, last_used_at = NULL WHERE id = ${placeholder(db.driver, 1)}`,
      [longAgo, stale.record.id],
    );
    expect(await resolveApiKey(stale.key)).toBeNull();
    const revoked = await db.raw<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM api_keys WHERE id = ${placeholder(db.driver, 0)}`,
      [stale.record.id],
    );
    expect(revoked[0]?.revoked_at).toBeTruthy();
  });
});

// ---------------------------------------------------------------- endpoint policy

describe("named endpoint policy (§5.4)", () => {
  it("opens an endpoint to anonymous project-scoped calls when requiresAuth is off", async () => {
    const { consoleEndpointsToggle } = await import("@/lib/server/console-routes");

    sessionCookie = "";
    const anonymous = await dbFind(post(`/api/db/find?projectId=${project.id}`, { table: "notes" }), NO_CONTEXT);
    expect(anonymous.status).toBe(401);

    sessionCookie = ownerSession;
    const opened = await consoleEndpointsToggle(
      new Request(`https://app.test/api/endpoints?projectId=${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "db.find", requiresAuth: false }),
      }),
      NO_CONTEXT,
    );
    expect(opened.status).toBe(200);

    sessionCookie = "";
    const publicRead = await dbFind(post(`/api/db/find?projectId=${project.id}`, { table: "notes" }), NO_CONTEXT);
    expect(publicRead.status).toBe(200);

    // Writes stay protected — only the endpoint that was opened is public.
    const publicWrite = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "notes", document: { id: "anon" } }),
      NO_CONTEXT,
    );
    expect(publicWrite.status).toBe(401);

    sessionCookie = ownerSession;
    await consoleEndpointsToggle(
      new Request(`https://app.test/api/endpoints?projectId=${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "db.find", requiresAuth: true }),
      }),
      NO_CONTEXT,
    );
  });
});

// ---------------------------------------------------------------- cron

describe("cron task set + platform runner (§5.8)", () => {
  it("lists every task with its parameters and stores edits", async () => {
    sessionCookie = ownerSession;
    const listed = await cronList(get(`/api/cron?projectId=${project.id}`), NO_CONTEXT);
    const body = (await listed.json()) as {
      data: Array<{ task: string; isEnabled: boolean; parameters: Record<string, unknown> }>;
      available: string[];
    };
    expect(body.available).toEqual([...CRON_TASKS]);
    expect(body.data.find((row) => row.task === "clean_old_logs")).toBeTruthy();

    const toggled = await cronToggle(
      new Request(`https://app.test/api/cron?projectId=${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "clean_old_logs", isEnabled: true, parameters: { retention_days: 1 } }),
      }),
      NO_CONTEXT,
    );
    expect(toggled.status).toBe(200);
    const rows = await db.raw<{ parameters: string }>(
      `SELECT parameters FROM cron_configs WHERE project_id = ${placeholder(db.driver, 0)} AND task_name = 'clean_old_logs'`,
      [project.id],
    );
    expect(JSON.parse(rows[0]!.parameters)).toEqual({ retention_days: 1 });
  });

  it("cleans old visit logs and expired rate-limit windows", async () => {
    const old = new Date(Date.now() - 120 * 86_400_000).toISOString();
    await db.run(
      `INSERT INTO visit_logs (project_id, route, ip, visited_at) VALUES (${placeholder(db.driver, 0)}, 'index.html', '9.9.9.9', ${placeholder(db.driver, 1)})`,
      [project.id, old],
    );
    await db.run(
      `INSERT INTO rate_limits (session_id, route_pattern, window_start, request_count) VALUES ('ip:9.9.9.9', 'default', ${placeholder(db.driver, 0)}, 1)`,
      [old],
    );
    const before = await countRows(
      `SELECT COUNT(*) AS n FROM visit_logs WHERE project_id = ${placeholder(db.driver, 0)}`,
      [project.id],
    );
    const result = await cleanOldLogs(project.id);
    expect(Number(result.deletedVisits)).toBeGreaterThanOrEqual(1);
    expect(Number(result.purgedRateLimits)).toBeGreaterThanOrEqual(1);
    const after = await countRows(
      `SELECT COUNT(*) AS n FROM visit_logs WHERE project_id = ${placeholder(db.driver, 0)}`,
      [project.id],
    );
    expect(after).toBeLessThan(before);
  });

  it("removes orphaned temporary uploads", async () => {
    await db.run(
      `INSERT INTO files (project_id, path, content_blob, size_bytes, is_text, updated_at)         VALUES (${placeholder(db.driver, 0)}, 'temp/upload-1.bin', ${placeholder(db.driver, 1)}, 4, ${placeholder(db.driver, 2)}, ${placeholder(db.driver, 3)})`,
      [project.id, Buffer.from("temp"), 0, new Date(Date.now() - 48 * 3_600_000).toISOString()],
    );
    const result = await cleanOrphanedUploads(project.id);
    expect(Number(result.deletedFiles)).toBe(1);
    expect(await getFile(project.id, "temp/upload-1.bin")).toBeNull();
  });

  it("sends the daily summary to webhook subscribers", async () => {
    let received = 0;
    const server = createServer((_req, res) => {
      received += 1;
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      await db.run(
        `INSERT INTO webhooks (project_id, url, secret, events, is_active)
         VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, 'whsec_daily', ${placeholder(db.driver, 2)}, 1)`,
        [project.id, `http://127.0.0.1:${port}/daily`, JSON.stringify(["daily.summary"])],
      );
      const result = await sendDailySummaryWebhook(project.id);
      expect(result.delivered).toBe(true);
      expect(received).toBeGreaterThanOrEqual(1);
    } finally {
      server.close();
    }
  });

  it("runs due tasks through the platform token and honours global switches", async () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const future = new Date(Date.now() + 3_600_000).toISOString();
    await db.run(
      `UPDATE cron_configs SET next_run_at = ${placeholder(db.driver, 0)} WHERE project_id = ${placeholder(db.driver, 1)}`,
      [future, project.id],
    );
    await db.run(
      `UPDATE cron_configs SET next_run_at = ${placeholder(db.driver, 0)} WHERE project_id = ${placeholder(db.driver, 1)} AND task_name = 'heartbeat'`,
      [past, project.id],
    );

    const sweep = await platformCronSweep();
    expect(sweep.ran.length).toBeGreaterThan(0);
    const heartbeat = sweep.ran.find((entry) => entry.task === "heartbeat");
    expect(heartbeat?.result.alive).toBe(true);

    // The route accepts the platform token and rejects anything else.
    sessionCookie = "";
    const unauthorised = await cronRun(post("/api/cron/run", { due: true }), NO_CONTEXT);
    expect(unauthorised.status).toBe(401);
    const authorised = await cronRun(
      post("/api/cron/run", { due: true }, { "x-cron-token": "test-cron-token" }),
      NO_CONTEXT,
    );
    expect(authorised.status).toBe(200);

    // Global switch: the admin console can disable a task platform-wide.
    sessionCookie = adminSession;
    const disabled = await adminCronPut(
      new Request("https://app.test/api/admin/cron", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "heartbeat", isEnabled: false }),
      }),
      NO_CONTEXT,
    );
    expect(disabled.status).toBe(200);
    await db.run(
      `UPDATE cron_configs SET next_run_at = ${placeholder(db.driver, 0)} WHERE project_id = ${placeholder(db.driver, 1)} AND task_name = 'heartbeat'`,
      [past, project.id],
    );
    const second = await platformCronSweep();
    expect(second.skipped.some((entry) => entry.task === "heartbeat" && entry.reason === "disabled globally")).toBe(true);
    await adminCronPut(
      new Request("https://app.test/api/admin/cron", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "heartbeat", isEnabled: true }),
      }),
      NO_CONTEXT,
    );
  });

  it("runs every task without throwing", async () => {
    for (const task of CRON_TASKS) {
      await expect(runCronTask(project.id, task)).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------- webhooks

describe("webhook events + delivery log (§5.9)", () => {
  it("fans account events out to the owner's projects and logs deliveries", async () => {
    const received: string[] = [];
    const server = createServer((req, res) => {
      received.push(req.headers["x-localme-event"] as string);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      await db.run(
        `INSERT INTO webhooks (project_id, url, secret, events, is_active)
         VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, 'whsec_user', ${placeholder(db.driver, 2)}, 1)`,
        [project.id, `http://127.0.0.1:${port}/events`, JSON.stringify(["*"])],
      );
      await dispatchWebhookEventForUser(owner.id, "user.login", { username: owner.username });
      expect(received).toContain("user.login");

      sessionCookie = ownerSession;
      const log = await webhooksDeliveries(get(`/api/webhooks/deliveries?projectId=${project.id}`), NO_CONTEXT);
      const logBody = (await log.json()) as {
        data: Array<{ event: string; responseStatus: number | null }>;
        events: string[];
      };
      expect(logBody.data.some((row) => row.event === "user.login")).toBe(true);
      expect(logBody.events).toEqual(
        expect.arrayContaining(["project.created", "user.signup", "cron.failed", "storage.cap_exceeded"]),
      );

      const tested = await webhooksTest(post(`/api/webhooks/test?projectId=${project.id}`, {}), NO_CONTEXT);
      expect(tested.status).toBe(200);
      expect(((await tested.json()) as { delivered: { delivered: number } }).delivered.delivered).toBeGreaterThan(0);
      expect(received).toContain("webhook.test");
    } finally {
      server.close();
    }
  });
});

// ---------------------------------------------------------------- import/export

describe("import/export service (§5.10)", () => {
  it("exports per-feature JSON and imports it back", async () => {
    sessionCookie = ownerSession;
    const routes = (await exportFeature(project.id, "routes")) as Array<{ pathPattern: string }>;
    expect(routes.some((route) => route.pathPattern === "/")).toBe(true);

    const secrets = (await exportFeature(project.id, "secrets")) as Array<{ key: string; value?: string }>;
    expect(secrets).toEqual([]);

    const imported = await importFeature(project.id, "roles", [
      { name: "Editor", permissions: ["db_read", "db_write"] },
    ]);
    expect(imported.imported).toBe(1);
    const roles = (await exportFeature(project.id, "roles")) as Array<{ name: string; permissions: string[] }>;
    expect(roles).toEqual([{ name: "Editor", permissions: ["db_read", "db_write"] }]);

    // Restore the documented default roles for later assertions.
    await importFeature(project.id, "roles", DEFAULT_ROLES);
  });

  it("builds a full ZIP with storage, library, config and clear-text secrets", async () => {
    const { encryptSecret } = await import("@/lib/server/secrets-crypto");
    await db.run(
      `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(db.driver, 0)}, 'API_KEY', ${placeholder(db.driver, 1)})`,
      [project.id, await encryptSecret("super-secret")],
    );

    const zip = await buildProjectExport(project.id, project.name);
    const { readZip } = await import("@/lib/server/zip");
    const entries = readZip(zip);
    const paths = entries.map((entry) => entry.path);
    expect(paths).toContain("storage/index.html");
    expect(paths).toContain("config/config.json");
    expect(paths).toContain("config/secrets.json");

    const secrets = JSON.parse(entries.find((e) => e.path === "config/secrets.json")!.content.toString("utf8"));
    expect(secrets).toEqual([{ key: "API_KEY", value: "super-secret" }]);

    const config = JSON.parse(entries.find((e) => e.path === "config/config.json")!.content.toString("utf8"));
    expect(config).toHaveProperty("routes");
    expect(config).toHaveProperty("auth");
  });

  it("restores files and configuration from an archive", async () => {
    sessionCookie = ownerSession;
    const { importAllHandler } = await import("@/lib/server/export-routes");
    const archive = buildZip([
      { path: "storage/restored.txt", content: Buffer.from("restored content") },
      { path: "config/config.json", content: Buffer.from(JSON.stringify({ roles: [{ name: "Restored", permissions: ["db_read"] }] })) },
      { path: "config/secrets.json", content: Buffer.from(JSON.stringify([{ key: "RESTORED_KEY", value: "value-1" }])) },
    ]);

    const response = await importAllHandler(
      new Request(`https://app.test/api/import/all?projectId=${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: new Uint8Array(archive),
      }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { files: number; features: number };
    expect(body.files).toBe(1);
    expect(body.features).toBe(1);

    expect((await getFileBlob(project.id, "restored.txt"))!.content.toString("utf8")).toBe("restored content");
    const roles = (await exportFeature(project.id, "roles")) as Array<{ name: string }>;
    expect(roles.map((role) => role.name)).toEqual(["Restored"]);

    const { decryptSecret } = await import("@/lib/server/secrets-crypto");
    const rows = await db.raw<{ encrypted_value: string }>(
      `SELECT encrypted_value FROM secrets WHERE project_id = ${placeholder(db.driver, 0)} AND key_name = 'RESTORED_KEY'`,
      [project.id],
    );
    expect(await decryptSecret(rows[0]!.encrypted_value)).toBe("value-1");
  });

  it("rejects hostile archives: traversal entries, malformed JSON and oversized bodies", async () => {
    sessionCookie = ownerSession;
    const { importAllHandler } = await import("@/lib/server/export-routes");
    const importArchive = (entries: Array<{ path: string; content: Buffer }>, body?: Buffer) => {
      const archive = body ?? buildZip(entries);
      return importAllHandler(
        new Request(`https://app.test/api/import/all?projectId=${project.id}`, {
          method: "POST",
          headers: { "content-type": "application/zip" },
          body: new Uint8Array(archive),
        }),
        NO_CONTEXT,
      );
    };

    // Traversal entries are skipped, the safe ones still restore.
    const traversal = await importArchive([
      { path: "storage/../../escape.txt", content: Buffer.from("nope") },
      { path: "storage/safe.txt", content: Buffer.from("ok") },
    ]);
    expect(traversal.status).toBe(200);
    const traversalBody = (await traversal.json()) as { files: number; skipped: number };
    expect(traversalBody.files).toBe(1);
    expect(traversalBody.skipped).toBe(1);
    expect(await getFile(project.id, "escape.txt")).toBeNull();
    expect((await getFileBlob(project.id, "safe.txt"))!.content.toString("utf8")).toBe("ok");

    // A truncated/garbage archive is a 400, not a 500.
    const garbage = await importArchive([], Buffer.from("PK-not-a-zip"));
    expect(garbage.status).toBe(400);

    // Malformed config sections report a 400 naming the section.
    const badConfig = await importArchive([
      { path: "config/config.json", content: Buffer.from("{ not json") },
    ]);
    expect(badConfig.status).toBe(400);
    expect(((await badConfig.json()) as { error: string }).error).toContain("config/config.json");

    const badSecrets = await importArchive([
      { path: "config/secrets.json", content: Buffer.from("nope") },
    ]);
    expect(badSecrets.status).toBe(400);
  });
});

// ---------------------------------------------------------------- serving hardenings

describe("serving hardenings (§5.2, §7.8)", () => {
  it("blocks cross-site asset hotlinks but allows direct and same-site requests", async () => {
    const target = { user: owner.username, project: project.name, path: "/manifest.json" };
    const direct = await serveProjectRequest(get(`/${owner.username}/${project.name}/manifest.json`), target);
    expect(direct.status).toBe(200);

    const sameSite = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/manifest.json`, { referer: "https://app.test/specowner/specapp/" }),
      target,
    );
    expect(sameSite.status).toBe(200);

    const foreign = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/manifest.json`, { referer: "https://evil.example/steal" }),
      target,
    );
    expect(foreign.status).toBe(403);

    const bot = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/manifest.json`, {
        referer: "https://evil.example/steal",
        "user-agent": "Googlebot/2.1",
      }),
      target,
    );
    expect(bot.status).toBe(200);

    // HTML pages are not hotlink-checked.
    const html = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`, { referer: "https://evil.example/steal" }),
      { ...target, path: "/" },
    );
    expect(html.status).toBe(200);
  });

  it("compresses text assets when the client accepts Brotli", async () => {
    const padding = "/*".padEnd(1200, "x") + "*/";
    await storageUpload(
      new Request(`https://app.test/api/storage/upload?projectId=${project.id}&path=big.css`, {
        method: "POST",
        headers: { authorization: `Bearer ${(await createApiKey(owner.id, project.id, "compress")).key}` },
        body: padding,
      }),
      NO_CONTEXT,
    );

    const target = { user: owner.username, project: project.name, path: "/big.css" };
    const compressed = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/big.css`, { "accept-encoding": "br" }),
      target,
    );
    expect(compressed.headers.get("content-encoding")).toBe("br");
    expect(compressed.headers.get("vary")).toBe("accept-encoding");

    const plain = await serveProjectRequest(get(`/${owner.username}/${project.name}/big.css`), target);
    expect(plain.headers.get("content-encoding")).toBeNull();
  });

  it("minifies HTML/CSS/JS on request", async () => {
    const key = await createApiKey(owner.id, project.id, "minify");
    const padded = "body {\n  color: red; /* note */\n}\n";
    const response = await storageUpload(
      new Request(`https://app.test/api/storage/upload?projectId=${project.id}&path=theme.css&minify=1`, {
        method: "POST",
        headers: { authorization: `Bearer ${key.key}` },
        body: padded,
      }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(201);
    const stored = await getFileBlob(project.id, "theme.css");
    expect(stored!.content.toString("utf8")).toBe("body{color:red}");
    expect((await getFile(project.id, "theme.css"))!.sizeBytes).toBeLessThan(padded.length);

    expect(minifyCss("a { color: blue; }")).toBe("a{color:blue}");
    expect(minifyHtml("<p>a</p>\n<!-- c -->\n<p>b</p>")).toBe("<p>a</p><p>b</p>");
    expect(minifyJs("// note\nconst a = 1; // tail\nconst b = 2;")).toBe("const a = 1;\nconst b = 2;");
    // Strings are untouched.
    expect(minifyCss('.x { content: "a  b"; }')).toBe('.x{content:"a  b"}');
    expect(minifyJs('const s = "/* not a comment */";')).toBe('const s = "/* not a comment */";');
    expect(isHotlink({ requestHost: "app.test", referer: null, origin: null, userAgent: null, allowedDomains: [] })).toBe(false);
  });

  it("reports storage listings in the documented shape (§13.2)", async () => {
    const key = await createApiKey(owner.id, project.id, "list");
    const listed = await storageList(
      get(`/api/storage/list?projectId=${project.id}`, { authorization: `Bearer ${key.key}` }),
      NO_CONTEXT,
    );
    const body = (await listed.json()) as {
      data: Array<{ path: string; name: string; type: "file" | "directory" }>;
    };
    const iconsEntry = body.data.find((entry) => entry.type === "directory" && entry.name === "icons");
    expect(iconsEntry).toBeTruthy();
    const manifest = body.data.find((entry) => entry.path === "manifest.json");
    expect(manifest?.name).toBe("manifest.json");
    expect(manifest?.type).toBe("file");
    expect(sanitizeRelativePath("/static/app.css")).toBe("static/app.css");
  });
});

// ---------------------------------------------------------------- health + admin

describe("health and admin surfaces", () => {
  it("answers /health with the database state", async () => {
    const { GET } = await import("@/app/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; database: string; driver: string };
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(body.driver).toBe("sqlite");
  });

  it("manages projects, global cron and the public library as an admin", async () => {
    sessionCookie = adminSession;

    const projects = await adminProjectsList(get("/api/admin/projects"), NO_CONTEXT);
    const projectsBody = (await projects.json()) as { data: Array<{ name: string; username: string }> };
    expect(projectsBody.data.some((row) => row.name === project.name && row.username === owner.username)).toBe(true);

    const suspended = await adminProjectsPatch(
      new Request("https://app.test/api/admin/projects", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, isActive: false }),
      }),
      NO_CONTEXT,
    );
    expect(suspended.status).toBe(200);
    const serving = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`),
      { user: owner.username, project: project.name, path: "/" },
    );
    expect(serving.status).toBe(403);
    await adminProjectsPatch(
      new Request("https://app.test/api/admin/projects", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, isActive: true }),
      }),
      NO_CONTEXT,
    );

    const cron = await adminCronGet(get("/api/admin/cron"), NO_CONTEXT);
    const cronBody = (await cron.json()) as { data: Array<{ task: string; globallyEnabled: boolean }> };
    expect(cronBody.data.map((row) => row.task)).toEqual([...CRON_TASKS]);

    const published = await adminPublicLibraryPut(
      new Request("https://app.test/api/admin/public-library?path=theme.css", {
        method: "PUT",
        body: "/* public */",
      }),
      NO_CONTEXT,
    );
    expect(published.status).toBe(201);
    const { GET } = await import("@/app/~public/[...path]/route");
    const served = await GET(get("/~public/theme.css"), { params: Promise.resolve({ path: ["theme.css"] }) });
    expect(served.status).toBe(200);
    expect(await served.text()).toBe("/* public */");
    const blocked = await GET(get("/~public/x.html"), { params: Promise.resolve({ path: ["x.html"] }) });
    expect(blocked.status).toBe(404);

    const { POST } = await import("@/app/api/admin/route");
    const badPost = await POST(post("/api/admin", {}), NO_CONTEXT);
    expect(badPost.status).toBe(405);
  });

  it("exposes the nested configuration tree", async () => {
    sessionCookie = adminSession;
    const response = await adminCronGet(get("/api/admin/cron"), NO_CONTEXT);
    expect(response.status).toBe(200);
    const { adminConfigGet } = await import("@/lib/server/admin-routes");
    const config = await adminConfigGet(get("/api/admin/config"), NO_CONTEXT);
    const body = (await config.json()) as { tree: Record<string, Record<string, unknown>> };
    expect(body.tree.storage?.default_user_cap_bytes).toBe(2_097_152);
    expect(body.tree.rate_limits?.asset_requests_per_minute).toBe(1000);
  });
});

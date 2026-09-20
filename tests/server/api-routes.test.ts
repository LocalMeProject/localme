/**
 * Platform API test suite (issue #5): exercises the route logic — auth, db DSL
 * endpoints, storage/library, secrets, webhooks, cron — against SQLite. Route
 * handlers are invoked through their exported wrapped functions with synthetic
 * Request objects; cookies() is unavailable outside a request scope, so
 * session-cookie flows are covered via API-key principals and the session
 * store directly (see tests/server/foundations.test.ts).
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "platform-api-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/server/db/index";
import {
  createApiKey,
  createProject,
  createUser,
} from "@/lib/server/repos";
import { dbDelete, dbFind, dbInsert, dbUpdate } from "@/lib/server/db-routes";
import {
  storageDelete,
  storageDownload,
  storageList,
  storageStatus,
  storageUpload,
} from "@/lib/server/storage-routes";
import {
  secretsDelete,
  secretsGet,
  secretsList,
  secretsUpsert,
} from "@/lib/server/secrets-routes";
import {
  dispatchWebhookEvent,
  webhooksCreate,
  webhooksDelete,
  webhooksList,
} from "@/lib/server/webhook-routes";
import { BUILTIN_TASKS, cronList, cronRun, cronToggle, runCronTask } from "@/lib/server/cron-routes";

let db: ReturnType<typeof getDb>;
let owner: { id: number };
let project: { id: number; name: string };
let apiKey = "";
const authHeaders = () => ({ authorization: `Bearer ${apiKey}` });

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  owner = await createUser("apiowner", "password123");
  project = await createProject(owner.id, "apiapp");
  const created = await createApiKey(owner.id, project.id, "tests");
  apiKey = created.key;
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
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

// ---------------------------------------------------------------- db endpoints

describe("db endpoints", () => {
  it("inserts, finds, updates, and deletes documents", async () => {
    const insert = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "users", document: { id: 1, name: "Ada", age: 36, active: true } }),
      { params: Promise.resolve({}) },
    );
    expect(insert.status).toBe(201);

    await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "users", document: { id: 2, name: "Ben", age: 17, active: true } }),
      { params: Promise.resolve({}) },
    );
    await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "users", document: { id: 3, name: "Cy", age: 50, active: false } }),
      { params: Promise.resolve({}) },
    );

    const found = await dbFind(
      post(`/api/db/find?projectId=${project.id}`, {
        table: "users",
        filter: { age: { $gt: 18 }, active: true },
        sort: { age: 1 },
      }),
      { params: Promise.resolve({}) },
    );
    const foundBody = (await found.json()) as { data: Array<{ name: string }>; total: number };
    expect(foundBody.data.map((d) => d.name)).toEqual(["Ada"]);
    expect(foundBody.total).toBe(1);

    const updated = await dbUpdate(
      post(`/api/db/update?projectId=${project.id}`, { table: "users", filter: { id: 1 }, update: { age: 37 } }),
      { params: Promise.resolve({}) },
    );
    const updatedBody = (await updated.json()) as { modified: number };
    expect(updatedBody.modified).toBe(1);

    const deleted = await dbDelete(
      post(`/api/db/delete?projectId=${project.id}`, { table: "users", filter: { id: 3 } }),
      { params: Promise.resolve({}) },
    );
    const deletedBody = (await deleted.json()) as { deleted: number };
    expect(deletedBody.deleted).toBe(1);
  });

  it("rejects invalid table names", async () => {
    const response = await dbFind(
      post(`/api/db/find?projectId=${project.id}`, { table: "not a table" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
  });

  it("rejects requests without authentication", async () => {
    const response = await dbFind(
      post(`/api/db/find?projectId=${project.id}`, { table: "users" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(401);
  });

  it("rejects duplicate document ids with a clear error", async () => {
    await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "dupe", document: { id: "x", v: 1 } }),
      { params: Promise.resolve({}) },
    );
    const again = await dbInsert(
      post(`/api/db/insert?projectId=${project.id}`, { table: "dupe", document: { id: "x", v: 2 } }),
      { params: Promise.resolve({}) },
    );
    expect(again.status).toBe(500); // store throws Error; handler maps to 500
  });
});

// ---------------------------------------------------------------- storage

describe("storage endpoints", () => {
  it("uploads, lists, downloads, and deletes files", async () => {
    const uploaded = await storageUpload(
      new Request(`https://app.test/api/storage/upload?projectId=${project.id}&path=assets/app.css`, {
        method: "POST",
        body: "body{}",
      }),
      { params: Promise.resolve({}) },
    );
    expect(uploaded.status).toBe(201);

    const listed = await storageList(
      get(`/api/storage/list?projectId=${project.id}`, authHeaders()),
      { params: Promise.resolve({}) },
    );
    const listedBody = (await listed.json()) as { data: Array<{ path: string }> };
    expect(listedBody.data.map((f) => f.path)).toContain("assets/app.css");

    const downloaded = await storageDownload(
      get(`/api/storage/download?projectId=${project.id}&path=assets/app.css`, authHeaders()),
      { params: Promise.resolve({}) },
    );
    expect((await downloaded.text())).toBe("body{}");

    const status = await storageStatus(
      get(`/api/storage/status?projectId=${project.id}`, authHeaders()),
      { params: Promise.resolve({}) },
    );
    const statusBody = (await status.json()) as { used: number; files: number };
    expect(statusBody.files).toBeGreaterThanOrEqual(1);
    expect(statusBody.used).toBeGreaterThan(0);

    const removed = await storageDelete(
      new Request(`https://app.test/api/storage/delete?projectId=${project.id}&path=assets/app.css`, { method: "POST", headers: authHeaders() }),
      { params: Promise.resolve({}) },
    );
    expect(removed.status).toBe(200);
  });

  it("rejects path traversal", async () => {
    const response = await storageUpload(
      new Request(`https://app.test/api/storage/upload?projectId=${project.id}&path=../evil.html`, {
        method: "POST",
        headers: authHeaders(),
        body: "x",
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------- secrets

describe("secrets endpoints", () => {
  it("stores without leaking the value, then retrieves it", async () => {
    const put = await secretsUpsert(
      post(`/api/secrets?projectId=${project.id}`, { key: "API_KEY", value: "super-secret-value" }, authHeaders()),
      { params: Promise.resolve({}) },
    );
    expect(put.status).toBe(200);

    const list = await secretsList(
      get(`/api/secrets?projectId=${project.id}`, authHeaders()),
      { params: Promise.resolve({}) },
    );
    const listBody = (await list.json()) as { data: Array<{ key: string }> };
    expect(listBody.data.map((s) => s.key)).toContain("API_KEY");
    expect(JSON.stringify(listBody)).not.toContain("super-secret-value");

    const got = await secretsGet(
      post(`/api/secrets/get?projectId=${project.id}`, { key: "API_KEY" }, authHeaders()),
      { params: Promise.resolve({}) },
    );
    const gotBody = (await got.json()) as { value: string };
    expect(gotBody.value).toBe("super-secret-value");

    const removed = await secretsDelete(
      new Request(`https://app.test/api/secrets?projectId=${project.id}&key=API_KEY`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
      { params: Promise.resolve({}) },
    );
    expect(removed.status).toBe(200);
  });
});

// ---------------------------------------------------------------- webhooks

describe("webhooks", () => {
  it("creates, lists, deletes, and signs dispatches", async () => {
    let received = false;
    // Minimal local receiver so dispatch has a real HTTP target in CI.
    const { createServer } = await import("node:http");
    const server = createServer((_req, res) => {
      received = true;
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const created = await webhooksCreate(
        post(`?projectId=${project.id}`, { url: `http://127.0.0.1:${port}/hook`, events: ["document.created"] }),
        { params: Promise.resolve({}) },
      );
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as { secret: string };
      expect(createdBody.secret).toMatch(/^whsec_/);

      const listed = await webhooksList(
        get(`?projectId=${project.id}`, authHeaders()),
        { params: Promise.resolve({}) },
      );
      const listedBody = (await listed.json()) as { data: Array<{ events: string[] }> };
      expect(listedBody.data.some((w) => w.events.includes("document.created"))).toBe(true);

      await dispatchWebhookEvent(project.id, "document.created", { id: "doc-1" });
      expect(received).toBe(true);

      const removed = await webhooksDelete(
        new Request(`https://app.test/?projectId=${project.id}&id=1`, { method: "DELETE", headers: authHeaders() }),
        { params: Promise.resolve({}) },
      );
      expect(removed.status).toBe(200);
    } finally {
      server.close();
    }
  });
});

// ---------------------------------------------------------------- cron

describe("cron", () => {
  it("toggles built-in tasks and runs them on demand", async () => {
    const toggled = await cronToggle(
      new Request(`https://app.test/?projectId=${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ task: "clean_expired_sessions", isEnabled: true }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(toggled.status).toBe(200);

    const listed = await cronList(
      get(`?projectId=${project.id}`, authHeaders()),
      { params: Promise.resolve({}) },
    );
    const listedBody = (await listed.json()) as { data: Array<{ task: string; isEnabled: boolean }>; available: string[] };
    expect(listedBody.available).toEqual([...BUILTIN_TASKS]);
    expect(listedBody.data.find((t) => t.task === "clean_expired_sessions")?.isEnabled).toBe(true);

    const ran = await cronRun(
      post(`?projectId=${project.id}`, { task: "clean_expired_sessions" }, authHeaders()),
      { params: Promise.resolve({}) },
    );
    const ranBody = (await ran.json()) as { result: { purgedSessions: number } };
    expect(ranBody.result).toHaveProperty("purgedSessions");
  });

  it("runs all built-in tasks without error", async () => {
    for (const task of BUILTIN_TASKS) {
      await expect(runCronTask(project.id, task)).resolves.toBeDefined();
    }
  });
});

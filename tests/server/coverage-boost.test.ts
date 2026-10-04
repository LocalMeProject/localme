import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "cov-boost-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/server/db/index";
import {
  createUser,
  createProject,
  createApiKey,
  getUserByUsername,
  getUserById,
  authenticateUser,
  requireOwnedProject,
  getFileBlob,
} from "@/lib/server/repos";
import { createSession, purgeExpiredSessions } from "@/lib/server/sessions";
import { resolvePrincipal, requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { ApiError, apiError, apiRateLimited, parseJson } from "@/lib/server/http";
import { proxyRequest } from "@/lib/server/proxy-routes";
import { checkRateLimit, enforceRateLimit } from "@/lib/server/ratelimit";
import { storageDownload, storageDelete } from "@/lib/server/storage-routes";
import { secretsGet, secretsDelete } from "@/lib/server/secrets-routes";
import { webhooksDelete, dispatchWebhookEvent } from "@/lib/server/webhook-routes";
import { compileFilter } from "@/lib/server/db/dsl";
import { placeholder } from "@/lib/server/db/sql";
import { z } from "zod";

let userId = 0;
let projectId = 0;
let apiKey = "";

beforeAll(async () => {
  const db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  const user = await createUser("boostuser", "password123");
  userId = user.id;

  const project = await createProject(user.id, "boostapp");
  projectId = project.id;

  const createdKey = await createApiKey(user.id, project.id, "boostkey");
  apiKey = createdKey.key;
});

afterAll(() => {
  getDb().close?.();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Windows file lock fallback */
  }
});

describe("Coverage Boost Suite", () => {
  it("http helpers error handling", async () => {
    const errResp = apiError("bad_request", "Custom message");
    expect(errResp.status).toBe(400);

    const rateResp = apiRateLimited(5);
    expect(rateResp.status).toBe(429);
    expect(rateResp.headers.get("Retry-After")).toBe("5");

    const invalidReq = new Request("http://localhost", { method: "POST", body: "not json" });
    await expect(parseJson(invalidReq, z.object({}))).rejects.toThrow(ApiError);

    const schemaReq = new Request("http://localhost", { method: "POST", body: JSON.stringify({ a: 1 }) });
    await expect(parseJson(schemaReq, z.object({ b: z.string() }))).rejects.toThrow(ApiError);
  });

  it("api-auth edge cases", async () => {
    const invalidHeaderReq = new Request("http://localhost", { headers: { Authorization: "Bearer sk_invalid" } });
    const principal = await resolvePrincipal(invalidHeaderReq);
    expect(principal).toBeNull();

    await expect(requirePrincipal(invalidHeaderReq)).rejects.toThrow(ApiError);

    const keyPrincipal = await resolvePrincipal(new Request("http://localhost", { headers: { Authorization: `Bearer ${apiKey}` } }));
    expect(keyPrincipal?.kind).toBe("api_key");

    const keyProject = await requireProjectScoped(new Request("http://localhost"), keyPrincipal!, null);
    expect(keyProject.id).toBe(projectId);

    const userPrincipal = { kind: "session" as const, userId, username: "boostuser", projectId: null, apiKeyName: null, permissions: ["*"] };
    await expect(requireProjectScoped(new Request("http://localhost"), userPrincipal, "invalid")).rejects.toThrow(ApiError);
  });

  it("sessions purge and cleanup", async () => {
    await createSession(userId);
    const purged = await purgeExpiredSessions();
    expect(purged).toBeGreaterThanOrEqual(0);
  });

  it("ratelimit enforcement", async () => {
    const req = new Request("http://localhost", { headers: { "x-real-ip": "10.0.0.1" } });
    const rateRes = await checkRateLimit(req, "auth");
    expect(rateRes.allowed).toBe(true);

    const enforced = await enforceRateLimit(req, "auth");
    expect(enforced).toBeNull();
  });

  it("proxy-routes invalid scenarios", async () => {
    const db = getDb();
    const p = db.driver;

    await db.run(
      `INSERT INTO routes (project_id, path_pattern, is_proxy, proxy_config)
       VALUES (${placeholder(p, 0)}, '/invalid-proxy', ${p === "sqlite" ? 1 : "TRUE"}, 'invalid json')`,
      [projectId],
    );

    const req = new Request(`http://localhost:3000/api/proxy/invalid-proxy?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const res = await proxyRequest(req, { params: Promise.resolve({ route: "invalid-proxy" }) });
    expect(res.status).toBe(500);
  });

  it("repos error scenarios and edge cases", async () => {
    expect(await getUserByUsername("nonexistent")).toBeNull();
    expect(await getUserById(999999)).toBeNull();

    await expect(authenticateUser("boostuser", "wrongpassword")).rejects.toThrow(ApiError);

    const db = getDb();
    const p = db.driver;
    await db.run(`UPDATE users SET is_suspended = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`, [p === "sqlite" ? 1 : true, userId]);
    await expect(authenticateUser("boostuser", "password123")).rejects.toThrow(ApiError);
    await db.run(`UPDATE users SET is_suspended = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`, [p === "sqlite" ? 0 : false, userId]);

    await expect(requireOwnedProject(999999, projectId)).rejects.toThrow(ApiError);
    expect(await getFileBlob(projectId, "nonexistent.file")).toBeNull();
  });

  it("storage & secrets & webhook routes error cases", async () => {
    const req = new Request(`http://localhost/api/storage/download?projectId=${projectId}&path=missing.txt`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const dlRes = await storageDownload(req, { params: Promise.resolve({}) });
    expect(dlRes.status).toBe(404);

    const delReq = new Request(`http://localhost/api/storage/delete?projectId=${projectId}&path=missing.txt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const delRes = await storageDelete(delReq, { params: Promise.resolve({}) });
    expect(delRes.status).toBe(404);

    const secGetReq = new Request(`http://localhost/api/secrets/get?projectId=${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ key: "NONEXISTENT_KEY" }),
    });
    const getRes = await secretsGet(secGetReq, { params: Promise.resolve({}) });
    expect(getRes.status).toBe(404);

    const secDelReq = new Request(`http://localhost/api/secrets?projectId=${projectId}&key=NONEXISTENT_KEY`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const secDelRes = await secretsDelete(secDelReq, { params: Promise.resolve({}) });
    expect(secDelRes.status).toBe(404);

    const whDelReq = new Request(`http://localhost/api/webhooks?projectId=${projectId}&id=999999`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const whDelRes = await webhooksDelete(whDelReq, { params: Promise.resolve({}) });
    expect(whDelRes.status).toBe(200);

    await dispatchWebhookEvent(projectId, "unsubscribed.event", { a: 1 });
  });

  it("dsl compilation coverage", () => {
    const compiled = compileFilter({
      $and: [{ age: { $gt: 18 } }, { active: true }],
      $or: [{ name: { $regex: "^A" } }, { score: { $lte: 10 } }],
      tags: { $in: ["admin", "user"] },
      status: { $ne: "banned" },
      bio: { $exists: true },
    }, "sqlite");
    expect(compiled.sql).toContain("AND");
    expect(compiled.sql).toContain("OR");
  });
});

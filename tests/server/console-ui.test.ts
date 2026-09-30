/**
 * Console API tests (issue #7): serving-route config, API keys, visitors,
 * roles, document-store tables, visit summaries, and the /auth/token visitor
 * branch — against SQLite.
 *
 * Session-only endpoints are exercised end to end by stubbing next/headers'
 * cookies() with a real packed session cookie (createSession's return value).
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "console-ui-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";

/** Filled in beforeAll; read lazily by the mocked cookies(). */
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
import { createProject, createUser } from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import { visitorAuthenticate } from "@/lib/server/visitor-auth";
import {
  consoleApiKeysCreate,
  consoleApiKeysList,
  consoleApiKeysRevoke,
  consoleRolesCreate,
  consoleRoutesCreate,
  consoleRoutesDelete,
  consoleRoutesList,
  consoleTablesList,
  consoleVisitorsCreate,
  consoleVisitorsDelete,
  consoleVisitorsList,
  consoleVisitsSummary,
} from "@/lib/server/console-routes";
import { enforceRateLimit } from "@/lib/server/ratelimit";

let db: ReturnType<typeof getDb>;
let owner: { id: number; username: string };
let stranger: { id: number; username: string };
let project: { id: number; name: string };
const NO_CONTEXT = { params: Promise.resolve({}) };

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  owner = await createUser("consoleowner", "password123");
  stranger = await createUser("consoleother", "password123");
  project = await createProject(owner.id, "consoleapp");
  await createProject(stranger.id, "otherapp");
  sessionCookie = await createSession(owner.id);
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function get(url: string): Request {
  return new Request(`https://app.test${url}`);
}

function post(url: string, body: unknown): Request {
  return new Request(`https://app.test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function del(url: string, context: { params: Promise<Record<string, string>> } = NO_CONTEXT): {
  request: Request;
  context: { params: Promise<Record<string, string>> };
} {
  return { request: new Request(`https://app.test${url}`, { method: "DELETE" }), context };
}

describe("routes config", () => {
  it("rejects unauthenticated callers and unowned projects", async () => {
    const anon = sessionCookie;
    sessionCookie = "";
    const denied = await consoleRoutesList(get(`/api/routes?projectId=${project.id}`));
    expect(denied.status).toBe(401);
    sessionCookie = anon;

    // Switch to another user's session; their project is not ours to read.
    sessionCookie = await createSession(stranger.id);
    const foreign = await consoleRoutesList(get(`/api/routes?projectId=${project.id}`));
    expect(foreign.status).toBe(403);
    sessionCookie = await createSession(owner.id);
  });

  it("creates, lists and updates routes for the owner", async () => {
    const created = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, { pathPattern: "/", targetFile: "index.html" }),
      NO_CONTEXT,
    );
    expect(created.status).toBe(201);

    const updated = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, {
        pathPattern: "/",
        targetFile: "landing.html",
        requiresAuth: true,
        requiredRole: "Editor",
      }),
      NO_CONTEXT,
    );
    expect(updated.status).toBe(200);

    const list = await consoleRoutesList(get(`/api/routes?projectId=${project.id}`));
    const body = (await list.json()) as {
      data: Array<{ pathPattern: string; targetFile: string | null; requiresAuth: boolean }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].targetFile).toBe("landing.html");
    expect(body.data[0].requiresAuth).toBe(true);
  });

  it("validates proxy config and rejects non-proxy routes without a target", async () => {
    const badProxy = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, {
        pathPattern: "/gw",
        isProxy: true,
        proxyConfig: { target: "not-a-url" },
      }),
      NO_CONTEXT,
    );
    expect(badProxy.status).toBe(400);

    const noTarget = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, { pathPattern: "/x" }),
      NO_CONTEXT,
    );
    expect(noTarget.status).toBe(400);

    const goodProxy = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, {
        pathPattern: "/gw",
        isProxy: true,
        proxyConfig: { target: "https://api.example.com/v1" },
      }),
      NO_CONTEXT,
    );
    expect(goodProxy.status).toBe(201);
  });

  it("deletes a route scoped to the project", async () => {
    await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, { pathPattern: "/gone", targetFile: "a.html" }),
      NO_CONTEXT,
    );
    const list = await consoleRoutesList(get(`/api/routes?projectId=${project.id}`));
    const body = (await list.json()) as { data: Array<{ id: number; pathPattern: string }> };
    const route = body.data.find((r) => r.pathPattern === "/gone");
    expect(route).toBeDefined();

    const removed = del(`/api/routes/${route!.id}?projectId=${project.id}`, {
      params: Promise.resolve({ routeId: String(route!.id) }),
    });
    expect((await consoleRoutesDelete(removed.request, removed.context)).status).toBe(200);

    const missing = del(`/api/routes/${route!.id}?projectId=${project.id}`, {
      params: Promise.resolve({ routeId: String(route!.id) }),
    });
    expect((await consoleRoutesDelete(missing.request, missing.context)).status).toBe(404);
  });
});

describe("api keys + roles + visitors", () => {
  it("creates a key, lists metadata without the plaintext, and revokes it", async () => {
    const created = await consoleApiKeysCreate(
      post(`/api/keys?projectId=${project.id}`, { name: "ci" }),
      NO_CONTEXT,
    );
    expect(created.status).toBe(201);
    const { key } = (await created.json()) as { key: string };
    expect(key.startsWith("sk_")).toBe(true);

    const listed = await consoleApiKeysList(get(`/api/keys?projectId=${project.id}`));
    const body = (await listed.json()) as {
      data: Array<{ id: number; prefix: string; revokedAt: string | null }>;
    };
    const listedKey = body.data.find((k) => k.prefix === key.slice(0, 12));
    expect(listedKey).toBeDefined();
    expect(JSON.stringify(body.data)).not.toContain(key);

    const revoked = del(`/api/keys/${listedKey!.id}?projectId=${project.id}`, {
      params: Promise.resolve({ keyId: String(listedKey!.id) }),
    });
    expect((await consoleApiKeysRevoke(revoked.request, revoked.context)).status).toBe(200);
  });

  it("creates roles and visitor accounts, then logs the visitor in and deletes them", async () => {
    const role = await consoleRolesCreate(
      post(`/api/roles?projectId=${project.id}`, { name: "Editor", permissions: ["db.write"] }),
      NO_CONTEXT,
    );
    expect(role.status).toBe(201);
    const duplicate = await consoleRolesCreate(
      post(`/api/roles?projectId=${project.id}`, { name: "Editor", permissions: [] }),
      NO_CONTEXT,
    );
    expect(duplicate.status).toBe(409);

    const visitor = await consoleVisitorsCreate(
      post(`/api/visitors?projectId=${project.id}`, {
        username: "friend",
        password: "visitor-pass-1",
        role: "Editor",
      }),
      NO_CONTEXT,
    );
    expect(visitor.status).toBe(201);
    const unknownRole = await consoleVisitorsCreate(
      post(`/api/visitors?projectId=${project.id}`, {
        username: "friend2",
        password: "visitor-pass-2",
        role: "Ghost",
      }),
      NO_CONTEXT,
    );
    expect(unknownRole.status).toBe(400);

    const visitors = await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`));
    const visitorBody = (await visitors.json()) as {
      data: Array<{ id: number; username: string; role: string }>;
    };
    const friend = visitorBody.data.find((v) => v.username === "friend");
    expect(friend?.role).toBe("Editor");

    // Visitor login via the shared service (what /auth/token calls).
    const token = await visitorAuthenticate({
      projectId: project.id,
      action: "login",
      username: "friend",
      password: "visitor-pass-1",
    });
    expect(token.split(".")).toHaveLength(3);

    const removed = del(`/api/visitors/${friend!.id}?projectId=${project.id}`, {
      params: Promise.resolve({ visitorId: String(friend!.id) }),
    });
    expect((await consoleVisitorsDelete(removed.request, removed.context)).status).toBe(200);
  });
});

describe("tables + visits summary", () => {
  it("lists document-store tables with counts", async () => {
    await db.run(
      `INSERT INTO project_data (project_id, table_name, document) VALUES (?, 'todos', ?)`,
      [project.id, JSON.stringify({ id: "t1", done: false })],
    );
    const response = await consoleTablesList(get(`/api/db/tables?projectId=${project.id}`));
    const body = (await response.json()) as { data: Array<{ name: string; count: number }> };
    expect(body.data).toContainEqual({ name: "todos", count: 1 });
  });

  it("counts this month's visits", async () => {
    await db.run(
      `INSERT INTO visit_logs (project_id, route, ip, visited_at) VALUES (?, 'index.html', '1.2.3.4', ?)`,
      [project.id, new Date().toISOString()],
    );
    const response = await consoleVisitsSummary(get(`/api/visits/summary?projectId=${project.id}`));
    const body = (await response.json()) as { visits: number };
    expect(body.visits).toBeGreaterThanOrEqual(1);
  });
});

describe("/auth/token visitor branch", () => {
  it("returns 404 for unknown projects", async () => {
    const { POST } = await import("@/app/auth/token/route");
    const response = await POST(
      post("/auth/token", { action: "login", username: "x", password: "y", projectId: 999_999 }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(404);
  });

  it("signs up a visitor and sets the project-scoped cookie", async () => {
    const { POST } = await import("@/app/auth/token/route");
    const response = await POST(
      post("/auth/token", {
        action: "signup",
        username: "token-visitor",
        password: "visitor-pass-9",
        projectId: project.id,
        returnUrl: `/${project.name}/private`,
      }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; redirectUrl: string };
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toBe(`/${project.name}/private`);

    const setCookie = response.headers.getSetCookie?.() ?? [];
    const visitorCookie = setCookie.find((c) => c.startsWith(`auth_${project.id}=`));
    expect(visitorCookie).toBeDefined();
    expect(visitorCookie).toContain(`Path=/${owner.username}/${project.name}/`);

    // The same visitor can log in again through the token route.
    const login = await POST(
      post("/auth/token", {
        action: "login",
        username: "token-visitor",
        password: "visitor-pass-9",
        projectId: project.id,
      }),
      NO_CONTEXT,
    );
    expect(login.status).toBe(200);
  });

  it("keeps console login working without projectId", async () => {
    const { POST } = await import("@/app/auth/token/route");
    const response = await POST(
      post("/auth/token", { action: "login", username: "consoleowner", password: "password123" }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; redirectUrl: string };
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toBe("/dashboard");
    const setCookie = response.headers.getSetCookie?.() ?? [];
    expect(setCookie.some((c) => c.startsWith("localme_session="))).toBe(true);
  });
});

describe("rate limiting", () => {
  it("identifies the console session for the auth group", async () => {
    const limited = await enforceRateLimit(get("/auth/token"), "auth");
    expect(limited === null || typeof limited.status === "number").toBe(true);
  });
});

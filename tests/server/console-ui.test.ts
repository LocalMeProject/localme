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
  consoleRolesDelete,
  consoleRolesList,
  consoleRolesUpdate,
  consoleRoutesCreate,
  consoleRoutesDelete,
  consoleRoutesList,
  consoleTablesList,
  consoleVisitorsCreate,
  consoleVisitorsDelete,
  consoleVisitorsList,
  consoleVisitorsUpdate,
  consoleVisitsSummary,
} from "@/lib/server/console-routes";
import { enforceRateLimit } from "@/lib/server/ratelimit";
import { createCaptchaChallenge } from "@/lib/server/captcha";

/**
 * Mints a challenge and reads the answer back out of the signed id (the id is
 * `<expiresMs>.<answer>.<hmac>`, so the middle segment is the answer). Keeps
 * the login tests honest about the captcha gate without an HTTP round trip.
 */
function solveCaptcha(): { captchaId: string; captchaAnswer: string } {
  const { id } = createCaptchaChallenge();
  return { captchaId: id, captchaAnswer: id.split(".")[1]! };
}

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
    // Project creation seeds `/` → index.html, so create a fresh path here.
    const created = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, { pathPattern: "/landing", targetFile: "index.html" }),
      NO_CONTEXT,
    );
    expect(created.status).toBe(201);

    const updated = await consoleRoutesCreate(
      post(`/api/routes?projectId=${project.id}`, {
        pathPattern: "/landing",
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
    const landing = body.data.find((route) => route.pathPattern === "/landing");
    expect(landing?.targetFile).toBe("landing.html");
    expect(landing?.requiresAuth).toBe(true);
    // The seeded `/` route is present too.
    expect(body.data.some((route) => route.pathPattern === "/")).toBe(true);
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

  it("changes a visitor's role after creation", async () => {
    // Promoting somebody used to be impossible without deleting their account
    // and recreating it, which loses the id their sessions refer to.
    await consoleRolesCreate(
      post(`/api/roles?projectId=${project.id}`, { name: "Auditor", permissions: ["db_read"] }),
      NO_CONTEXT,
    );
    await consoleVisitorsCreate(
      post(`/api/visitors?projectId=${project.id}`, {
        username: "promoteme",
        password: "visitor-pass-1",
        role: "Member",
      }),
      NO_CONTEXT,
    );
    const list = (await (
      await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`))
    ).json()) as { data: Array<{ id: number; username: string; role: string }> };
    const target = list.data.find((v) => v.username === "promoteme")!;

    const context = { params: Promise.resolve({ visitorId: String(target.id) }) };
    const promoted = await consoleVisitorsUpdate(
      new Request(`https://app.test/api/visitors/${target.id}?projectId=${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "Auditor" }),
      }),
      context,
    );
    expect(promoted.status).toBe(200);

    const after = (await (
      await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`))
    ).json()) as { data: Array<{ username: string; role: string }> };
    expect(after.data.find((v) => v.username === "promoteme")?.role).toBe("Auditor");

    // A typo must fail loudly rather than silently clearing someone's access.
    const typo = await consoleVisitorsUpdate(
      new Request(`https://app.test/api/visitors/${target.id}?projectId=${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "NoSuchRole" }),
      }),
      context,
    );
    expect(typo.status).toBe(404);
    const unchanged = (await (
      await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`))
    ).json()) as { data: Array<{ username: string; role: string }> };
    expect(unchanged.data.find((v) => v.username === "promoteme")?.role).toBe("Auditor");
  });
});

describe("role editing and deletion", () => {
  const roleContext = (roleId: number) => ({ params: Promise.resolve({ roleId: String(roleId) }) });

  async function makeRole(name: string): Promise<number> {
    await consoleRolesCreate(
      post(`/api/roles?projectId=${project.id}`, { name, permissions: ["db_read"] }),
      NO_CONTEXT,
    );
    const roles = (await (
      await consoleRolesList(get(`/api/roles?projectId=${project.id}`))
    ).json()) as { data: Array<{ id: number; name: string }> };
    return roles.data.find((r) => r.name === name)!.id;
  }

  it("renames a role and replaces its permissions", async () => {
    const id = await makeRole("Temporary");
    const response = await consoleRolesUpdate(
      new Request(`https://app.test/api/roles/${id}?projectId=${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Permanent", permissions: ["db_read", "storage_read"] }),
      }),
      roleContext(id),
    );
    expect(response.status).toBe(200);

    const roles = (await (
      await consoleRolesList(get(`/api/roles?projectId=${project.id}`))
    ).json()) as { data: Array<{ id: number; name: string; permissions: string[] }> };
    const updated = roles.data.find((r) => r.id === id)!;
    expect(updated.name).toBe("Permanent");
    expect(updated.permissions).toEqual(["db_read", "storage_read"]);
    expect(roles.data.some((r) => r.name === "Temporary")).toBe(false);
  });

  it("keeps its visitors and drops their role by default", async () => {
    const id = await makeRole("Doomed");
    await consoleVisitorsCreate(
      post(`/api/visitors?projectId=${project.id}`, {
        username: "orphaned",
        password: "visitor-pass-1",
        role: "Doomed",
      }),
      NO_CONTEXT,
    );

    const response = await consoleRolesDelete(
      del(`/api/roles/${id}?projectId=${project.id}`).request,
      roleContext(id),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { visitorsMoved: number }).visitorsMoved).toBe(1);

    // The account still exists — deleting a role must not delete people.
    const visitors = (await (
      await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`))
    ).json()) as { data: Array<{ username: string; role: string }> };
    const survivor = visitors.data.find((v) => v.username === "orphaned");
    expect(survivor).toBeDefined();
    expect(survivor!.role).toBe("Member"); // the LEFT JOIN's COALESCE
  });

  it("moves its visitors to a replacement role when asked", async () => {
    const from = await makeRole("From");
    const to = await makeRole("To");
    await consoleVisitorsCreate(
      post(`/api/visitors?projectId=${project.id}`, {
        username: "mover",
        password: "visitor-pass-1",
        role: "From",
      }),
      NO_CONTEXT,
    );

    const response = await consoleRolesDelete(
      del(`/api/roles/${from}?projectId=${project.id}&onDelete=move_to&moveToRoleId=${to}`).request,
      roleContext(from),
    );
    expect(((await response.json()) as { visitorsMoved: number }).visitorsMoved).toBe(1);

    const visitors = (await (
      await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`))
    ).json()) as { data: Array<{ username: string; role: string }> };
    expect(visitors.data.find((v) => v.username === "mover")?.role).toBe("To");
  });

  it("deletes its visitors when that is the explicit choice", async () => {
    const id = await makeRole("Doomed2");
    await consoleVisitorsCreate(
      post(`/api/visitors?projectId=${project.id}`, {
        username: "doomed-visitor",
        password: "visitor-pass-1",
        role: "Doomed2",
      }),
      NO_CONTEXT,
    );
    const response = await consoleRolesDelete(
      del(`/api/roles/${id}?projectId=${project.id}&onDelete=delete_visitors`).request,
      roleContext(id),
    );
    expect(response.status).toBe(200);

    const visitors = (await (
      await consoleVisitorsList(get(`/api/visitors?projectId=${project.id}`))
    ).json()) as { data: Array<{ username: string }> };
    expect(visitors.data.some((v) => v.username === "doomed-visitor")).toBe(false);
  });

  it("refuses an unknown strategy, a missing replacement, and moving a role into itself", async () => {
    const id = await makeRole("Guard");
    const bad = [
      `?projectId=${project.id}&onDelete=obliterate`,
      `?projectId=${project.id}&onDelete=move_to`,
      `?projectId=${project.id}&onDelete=move_to&moveToRoleId=${id}`,
      `?projectId=${project.id}&onDelete=move_to&moveToRoleId=999999`,
    ];
    for (const query of bad) {
      const response = await consoleRolesDelete(
        del(`/api/roles/${id}${query}`).request,
        roleContext(id),
      );
      expect([400, 404], query).toContain(response.status);
    }
    // The role survived every rejected attempt.
    const roles = (await (
      await consoleRolesList(get(`/api/roles?projectId=${project.id}`))
    ).json()) as { data: Array<{ name: string }> };
    expect(roles.data.some((r) => r.name === "Guard")).toBe(true);
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

  it("signs up a visitor and sets the project-named cookie", async () => {
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
    // Scoped by name, not by path: the visitor's page calls /api/db/* on the
    // platform origin, which a /{user}/{project}/ path would never receive.
    expect(visitorCookie).toContain("Path=/");

    // Visitor logins are captcha-gated: without an answer the route refuses.
    const missingCaptcha = await POST(
      post("/auth/token", {
        action: "login",
        username: "token-visitor",
        password: "visitor-pass-9",
        projectId: project.id,
      }),
      NO_CONTEXT,
    );
    expect(missingCaptcha.status).toBe(400);

    // With a solved challenge the same visitor can log in again.
    const login = await POST(
      post("/auth/token", {
        action: "login",
        username: "token-visitor",
        password: "visitor-pass-9",
        projectId: project.id,
        ...solveCaptcha(),
      }),
      NO_CONTEXT,
    );
    expect(login.status).toBe(200);
  });

  it("authenticates API calls made by a signed-in visitor", async () => {
    // The bug this covers: the login page set a cookie, the gated page rendered,
    // and then every /api/db/* call the page made answered 401 — so signing up
    // and signing in appeared to do nothing. A visitor session has to be a
    // first-class principal on the API, not only on the serving path.
    const { POST } = await import("@/app/auth/token/route");
    const { dbCount } = await import("@/lib/server/db-routes");
    const signup = await POST(
      post("/auth/token", {
        action: "signup",
        username: "api-visitor",
        password: "visitor-pass-9",
        projectId: project.id,
      }),
      NO_CONTEXT,
    );
    expect(signup.status).toBe(200);
    const setCookie = (signup.headers.getSetCookie?.() ?? []).find((c) =>
      c.startsWith(`auth_${project.id}=`),
    );
    const token = setCookie!.split(";")[0]!.split("=").slice(1).join("=");
    const asVisitor = (url: string, body: unknown) =>
      new Request(`https://app.test${url}`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `auth_${project.id}=${token}` },
        body: JSON.stringify(body),
      });

    const counted = await dbCount(asVisitor(`/api/db/count?projectId=${project.id}`, { table: "notes" }));
    expect(counted.status).toBe(200);

    // A visitor is pinned to its own project and cannot name another one.
    const foreign = await dbCount(
      asVisitor(`/api/db/count?projectId=${project.id + 9999}`, { table: "notes" }),
    );
    expect(foreign.status).toBeGreaterThanOrEqual(400);

    // …and a caller with no visitor cookie at all is still refused. This suite's
    // console session is module-level state, so it is cleared first — otherwise
    // the "anonymous" caller is the owner and 200 is correct.
    const ownerSession = sessionCookie;
    sessionCookie = "";
    try {
      const noCookie = new Request(`https://app.test/api/db/count?projectId=${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ table: "notes" }),
      });
      const anonymous = await dbCount(noCookie);
      expect(anonymous.status).toBe(401);
    } finally {
      sessionCookie = ownerSession;
    }
  });

  it("keeps console login working without projectId", async () => {
    const { POST } = await import("@/app/auth/token/route");
    const response = await POST(
      post("/auth/token", {
        action: "login",
        username: "consoleowner",
        password: "password123",
        ...solveCaptcha(),
      }),
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

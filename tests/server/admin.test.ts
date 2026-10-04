/**
 * Unit and integration tests for Admin & Operator modules:
 * - lib/server/admin/common.ts
 * - lib/server/admin/overview.ts
 * - lib/server/admin/users.ts
 * - lib/server/admin/projects.ts
 * - lib/server/admin/impersonate.ts
 * - lib/server/admin/cron.ts
 * - lib/server/admin/config.ts
 * - lib/server/admin/public-library.ts
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "admin-test-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "admin-test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "admin-test-encryption-key-32-byt!";

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
import {
  adminStats,
  adminOverview,
  adminSessionsRevoke,
  adminUsersList,
  adminUserDetail,
  adminUsersPatch,
  adminUsersDelete,
  adminProjectsList,
  adminProjectsPatch,
  adminProjectsDelete,
  adminImpersonateStart,
  adminImpersonateStop,
  adminImpersonateStatus,
  adminCronGet,
  adminCronPut,
  adminConfigGet,
  adminConfigTree,
  adminConfigSet,
  adminPublicLibraryList,
  adminPublicLibraryPut,
  adminPublicLibraryDelete,
  readPublicLibraryFile,
  requireAdmin,
  requireOperator,
  readPaging,
} from "@/lib/server/admin-routes";

let db: ReturnType<typeof getDb>;
let adminUser: { id: number; username: string };
let operatorUser: { id: number; username: string };
let regularUser: { id: number; username: string };
let otherUser: { id: number; username: string };
let adminSessionCookie: string;
let operatorSessionCookie: string;
let regularSessionCookie: string;

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  adminUser = await createUser("superadmin", "Password123!");
  operatorUser = await createUser("opsuser", "Password123!");
  regularUser = await createUser("reguser", "Password123!");
  otherUser = await createUser("otheruser", "Password123!");

  await db.run("UPDATE users SET is_admin = 1 WHERE id = ?", [adminUser.id]);
  await db.run("UPDATE users SET is_operator = 1 WHERE id = ?", [operatorUser.id]);

  adminSessionCookie = await createSession(adminUser.id);
  operatorSessionCookie = await createSession(operatorUser.id);
  regularSessionCookie = await createSession(regularUser.id);
});

afterAll(() => {
  db.close?.();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
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

function patch(url: string, body: unknown): Request {
  return new Request(`https://app.test${url}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function put(url: string, body: unknown): Request {
  return new Request(`https://app.test${url}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function del(url: string, body?: unknown): Request {
  return new Request(`https://app.test${url}`, {
    method: "DELETE",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Admin auth guards and common helpers", () => {
  it("rejects non-operator and non-admin calls", async () => {
    sessionCookie = regularSessionCookie;
    await expect(requireOperator(get("/api/admin/stats"))).rejects.toThrow("Operator access required");
    await expect(requireAdmin(get("/api/admin/stats"))).rejects.toThrow("Admin access required");
  });

  it("permits operator for requireOperator and rejects for requireAdmin", async () => {
    sessionCookie = operatorSessionCookie;
    const op = await requireOperator(get("/api/admin/stats"));
    expect(op.isOperator).toBe(true);
    expect(op.isAdmin).toBe(false);
    await expect(requireAdmin(get("/api/admin/stats"))).rejects.toThrow("Admin access required");
  });

  it("permits admin for both requireOperator and requireAdmin", async () => {
    sessionCookie = adminSessionCookie;
    const admin = await requireAdmin(get("/api/admin/stats"));
    expect(admin.userId).toBe(adminUser.id);
    const op = await requireOperator(get("/api/admin/stats"));
    expect(op.isAdmin).toBe(true);
    expect(op.isOperator).toBe(true);
  });

  it("readPaging respects constraints and defaults", () => {
    const p1 = readPaging(new URL("https://app.test/api/admin/users"));
    expect(p1.page).toBe(1);
    expect(p1.pageSize).toBe(25);
    expect(p1.offset).toBe(0);

    const p2 = readPaging(new URL("https://app.test/api/admin/users?page=3&pageSize=500"));
    expect(p2.page).toBe(3);
    expect(p2.pageSize).toBe(200); // capped at 200
    expect(p2.offset).toBe(400);

    const p3 = readPaging(new URL("https://app.test/api/admin/users?page=-5&pageSize=10"));
    expect(p3.page).toBe(1);
    expect(p3.pageSize).toBe(10);
    expect(p3.offset).toBe(0);
  });
});

describe("Admin stats and overview", () => {
  it("returns platform statistics", async () => {
    sessionCookie = adminSessionCookie;
    const res = await adminStats(get("/api/admin/stats"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toBeGreaterThanOrEqual(4);
    expect(body.projects).toBeGreaterThanOrEqual(0);
  });

  it("returns detailed overview metrics", async () => {
    sessionCookie = operatorSessionCookie;
    const res = await adminOverview(get("/api/admin/overview"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewer.isOperator).toBe(true);
    expect(body.viewer.isAdmin).toBe(false);
    expect(body.health).toBeDefined();
    expect(body.week).toBeDefined();
  });
});

describe("Admin user management", () => {
  it("lists users with various filters and sorting", async () => {
    sessionCookie = adminSessionCookie;
    // Default list
    let res = await adminUsersList(get("/api/admin/users"));
    let json = await res.json();
    expect(json.total).toBeGreaterThanOrEqual(4);

    // Filter by admin
    res = await adminUsersList(get("/api/admin/users?status=admin"));
    json = await res.json();
    expect(json.data.some((u: any) => u.username === "superadmin")).toBe(true);
    expect(json.data.every((u: any) => u.isAdmin)).toBe(true);

    // Filter by active
    res = await adminUsersList(get("/api/admin/users?status=active"));
    json = await res.json();
    expect(json.data.every((u: any) => !u.isSuspended)).toBe(true);

    // Search query & sort
    res = await adminUsersList(get("/api/admin/users?q=reguser&sort=username"));
    json = await res.json();
    expect(json.data.length).toBe(1);
    expect(json.data[0].username).toBe("reguser");

    // Other sorts
    for (const sort of ["storage", "projects", "lastLogin"]) {
      const sRes = await adminUsersList(get(`/api/admin/users?sort=${sort}`));
      expect(sRes.status).toBe(200);
    }
  });

  it("fetches single user details", async () => {
    sessionCookie = operatorSessionCookie;
    // Missing param
    const badRes = await adminUserDetail(get("/api/admin/users"));
    expect(badRes.status).toBe(400);

    // Not found
    const nfRes = await adminUserDetail(get("/api/admin/users?userId=99999"));
    expect(nfRes.status).toBe(404);

    // Success
    const okRes = await adminUserDetail(get(`/api/admin/users?userId=${regularUser.id}`));
    expect(okRes.status).toBe(200);
    const json = await okRes.json();
    expect(json.data.username).toBe("reguser");
  });

  it("patches user accounts with permission checks", async () => {
    // Operator trying to grant admin is rejected
    sessionCookie = operatorSessionCookie;
    const opGrantAdmin = await adminUsersPatch(
      patch("/api/admin/users", { userId: regularUser.id, isAdmin: true }),
    );
    expect(opGrantAdmin.status).toBe(403);

    // Admin can update storageCapBytes, suspend/resume, promote/demote
    sessionCookie = adminSessionCookie;
    const patchOk = await adminUsersPatch(
      patch("/api/admin/users", {
        userId: regularUser.id,
        isSuspended: true,
        storageCapBytes: 10485760,
      }),
    );
    expect(patchOk.status).toBe(200);
    const patchData = await patchOk.json();
    expect(patchData.affected).toBe(1);

    // Filter by suspended now shows regularUser
    const suspList = await adminUsersList(get("/api/admin/users?status=suspended"));
    const suspJson = await suspList.json();
    expect(suspJson.data.some((u: any) => u.username === "reguser")).toBe(true);

    // Admin resumes regularUser and tests unlock
    const resumeOk = await adminUsersPatch(
      patch("/api/admin/users", { userId: regularUser.id, isSuspended: false, unlock: true }),
    );
    expect(resumeOk.status).toBe(200);

    // Cannot suspend or demote self
    const selfDemote = await adminUsersPatch(
      patch("/api/admin/users", { userId: adminUser.id, isAdmin: false }),
    );
    expect(selfDemote.status).toBe(400);

    // Exceeding storage cap ceiling is rejected
    const hugeCap = await adminUsersPatch(
      patch("/api/admin/users", { userId: regularUser.id, storageCapBytes: 99999999999999 }),
    );
    expect(hugeCap.status).toBe(400);

    // Empty patch is rejected
    const emptyPatch = await adminUsersPatch(patch("/api/admin/users", { userId: regularUser.id }));
    expect(emptyPatch.status).toBe(400);
  });

  it("deletes user accounts safely", async () => {
    const toDelete = await createUser("user_to_delete", "Password123!");

    // Non-admin cannot delete
    sessionCookie = operatorSessionCookie;
    const opDel = await adminUsersDelete(
      del("/api/admin/users", { userId: toDelete.id, confirmUsername: "user_to_delete" }),
    );
    expect(opDel.status).toBe(403);

    sessionCookie = adminSessionCookie;
    // Cannot delete self
    const selfDel = await adminUsersDelete(
      del("/api/admin/users", { userId: adminUser.id, confirmUsername: "superadmin" }),
    );
    expect(selfDel.status).toBe(400);

    // Wrong confirmation username
    const wrongName = await adminUsersDelete(
      del("/api/admin/users", { userId: toDelete.id, confirmUsername: "wrongname" }),
    );
    expect(wrongName.status).toBe(400);

    // Not found
    const notFound = await adminUsersDelete(
      del("/api/admin/users", { userId: 88888, confirmUsername: "anything" }),
    );
    expect(notFound.status).toBe(404);

    // Valid delete
    const successDel = await adminUsersDelete(
      del("/api/admin/users", { userId: toDelete.id, confirmUsername: "user_to_delete" }),
    );
    expect(successDel.status).toBe(200);
  });
});

describe("Admin project management", () => {
  let testProject: { id: number; name: string };

  beforeAll(async () => {
    testProject = await createProject(regularUser.id, "project-alpha");
  });

  it("lists projects with filters and sorts", async () => {
    sessionCookie = operatorSessionCookie;
    let res = await adminProjectsList(get("/api/admin/projects"));
    let json = await res.json();
    expect(json.total).toBeGreaterThanOrEqual(1);

    // Search and owner filters
    res = await adminProjectsList(get(`/api/admin/projects?q=alpha&owner=reguser`));
    json = await res.json();
    expect(json.data.some((p: any) => p.name === "project-alpha")).toBe(true);

    // Different sorts
    for (const sort of ["name", "files", "storage", "visits"]) {
      const sRes = await adminProjectsList(get(`/api/admin/projects?sort=${sort}`));
      expect(sRes.status).toBe(200);
    }
  });

  it("patches project settings", async () => {
    sessionCookie = operatorSessionCookie;
    const res = await adminProjectsPatch(
      patch("/api/admin/projects", {
        projectId: testProject.id,
        isActive: false,
        freeVisitsPerMonth: 5000,
        watermarkEnabled: false,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.affected).toBe(1);

    // Project now filtered under suspended
    const suspRes = await adminProjectsList(get("/api/admin/projects?status=suspended"));
    const suspJson = await suspRes.json();
    expect(suspJson.data.some((p: any) => p.id === testProject.id)).toBe(true);

    // Re-activate
    await adminProjectsPatch(
      patch("/api/admin/projects", { projectId: testProject.id, isActive: true }),
    );
  });

  it("deletes a project safely", async () => {
    const toDeleteProj = await createProject(regularUser.id, "project-to-delete");

    // Non-admin cannot delete
    sessionCookie = operatorSessionCookie;
    const opDel = await adminProjectsDelete(
      del("/api/admin/projects", { projectId: toDeleteProj.id, confirmName: "project-to-delete" }),
    );
    expect(opDel.status).toBe(403);

    sessionCookie = adminSessionCookie;
    // Mismatched name
    const badName = await adminProjectsDelete(
      del("/api/admin/projects", { projectId: toDeleteProj.id, confirmName: "wrong" }),
    );
    expect(badName.status).toBe(400);

    // Not found
    const notFound = await adminProjectsDelete(
      del("/api/admin/projects", { projectId: 99999, confirmName: "nope" }),
    );
    expect(notFound.status).toBe(404);

    // Success
    const ok = await adminProjectsDelete(
      del("/api/admin/projects", { projectId: toDeleteProj.id, confirmName: "project-to-delete" }),
    );
    expect(ok.status).toBe(200);
  });
});

describe("Admin impersonation flows", () => {
  it("handles impersonation start, status, and stop", async () => {
    sessionCookie = operatorSessionCookie;

    // Cannot impersonate self
    const selfImp = await adminImpersonateStart(post("/api/admin/impersonate", { userId: operatorUser.id }));
    expect(selfImp.status).toBe(400);

    // Operator cannot impersonate an admin
    const opImpAdmin = await adminImpersonateStart(post("/api/admin/impersonate", { userId: adminUser.id }));
    expect(opImpAdmin.status).toBe(403);

    // Impersonate normal user (otherUser)
    const startRes = await adminImpersonateStart(post("/api/admin/impersonate", { userId: otherUser.id }));
    expect(startRes.status).toBe(200);
    const startJson = await startRes.json();
    expect(startJson.impersonated.username).toBe("otheruser");

    // Extract the impersonation session cookie
    const setCookie = startRes.cookies.get("localme_session");
    expect(setCookie).toBeDefined();
    sessionCookie = setCookie!.value;

    // Check status
    const statusRes = await adminImpersonateStatus(get("/api/admin/impersonate"));
    const statusJson = await statusRes.json();
    expect(statusJson.impersonatedBy).toBe("opsuser");

    // Stop impersonation
    const stopRes = await adminImpersonateStop(post("/api/admin/impersonate/stop", {}));
    expect(stopRes.status).toBe(200);
    const stopCookie = stopRes.cookies.get("localme_session");
    expect(stopCookie).toBeDefined();

    // Stopping again without impersonation throws 400
    sessionCookie = stopCookie!.value;
    const badStop = await adminImpersonateStop(post("/api/admin/impersonate/stop", {}));
    expect(badStop.status).toBe(400);
  });
});

describe("Admin session revocation", () => {
  it("allows operator to revoke regular user session and admin to revoke admin session", async () => {
    sessionCookie = operatorSessionCookie;
    // Operator revoking regular user sessions
    const opRevoke = await adminSessionsRevoke(del(`/api/admin/sessions?userId=${regularUser.id}`));
    expect(opRevoke.status).toBe(200);

    // Operator cannot revoke admin sessions
    const opRevokeAdmin = await adminSessionsRevoke(del(`/api/admin/sessions?userId=${adminUser.id}`));
    expect(opRevokeAdmin.status).toBe(403);

    // Admin can revoke admin sessions
    sessionCookie = adminSessionCookie;
    const adminRevoke = await adminSessionsRevoke(del(`/api/admin/sessions?userId=${adminUser.id}`));
    expect(adminRevoke.status).toBe(200);
  });
});

describe("Admin cron management", () => {
  it("reads and toggles cron tasks", async () => {
    sessionCookie = operatorSessionCookie;
    const getRes = await adminCronGet(get("/api/admin/cron"));
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.length).toBeGreaterThan(0);

    const firstTask = getJson.data[0].task;
    const putRes = await adminCronPut(
      put("/api/admin/cron", { task: firstTask, isEnabled: false }),
    );
    expect(putRes.status).toBe(200);
    const putJson = await putRes.json();
    expect(putJson.isEnabled).toBe(false);

    // Re-enable
    await adminCronPut(put("/api/admin/cron", { task: firstTask, isEnabled: true }));
  });
});

describe("Admin system configuration", () => {
  it("reads configuration and trees", async () => {
    sessionCookie = operatorSessionCookie;
    const cGet = await adminConfigGet(get("/api/admin/config"));
    expect(cGet.status).toBe(200);
    const cJson = await cGet.json();
    expect(cJson.defaults).toBeDefined();

    const cTree = await adminConfigTree(get("/api/admin/config/tree"));
    expect(cTree.status).toBe(200);
    const treeJson = await cTree.json();
    expect(treeJson.tree).toBeDefined();
  });

  it("updates config and rejects unknown keys", async () => {
    sessionCookie = operatorSessionCookie;
    // Unknown key
    const badKey = await adminConfigSet(
      put("/api/admin/config", { key: "nonexistent.config.key", value: 123 }),
    );
    expect(badKey.status).toBe(400);

    // Valid key
    const okKey = await adminConfigSet(
      put("/api/admin/config", { key: "auth.max_login_attempts", value: 7 }),
    );
    expect(okKey.status).toBe(200);
    const okJson = await okKey.json();
    expect(okJson.value).toBe(7);
  });
});

describe("Admin public library", () => {
  it("uploads, lists, reads, and deletes public library files", async () => {
    sessionCookie = operatorSessionCookie;

    // Reject HTML
    const htmlReq = new Request("https://app.test/api/admin/public-library?path=index.html", {
      method: "PUT",
      body: Buffer.from("<h1>evil</h1>"),
    });
    const htmlRes = await adminPublicLibraryPut(htmlReq);
    expect(htmlRes.status).toBe(400);

    // Upload CSS
    const cssReq = new Request("https://app.test/api/admin/public-library?path=styles/main.css", {
      method: "PUT",
      body: Buffer.from("body { background: black; }"),
    });
    const cssRes = await adminPublicLibraryPut(cssReq);
    expect(cssRes.status).toBe(201);

    // List library files
    const listRes = await adminPublicLibraryList(get("/api/admin/public-library"));
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.data.some((f: any) => f.path === "styles/main.css")).toBe(true);

    // Read library file
    const file = await readPublicLibraryFile("styles/main.css");
    expect(file).not.toBeNull();
    expect(file!.content.toString("utf8")).toBe("body { background: black; }");

    // Delete library file
    const delRes = await adminPublicLibraryDelete(
      new Request("https://app.test/api/admin/public-library?path=styles/main.css", {
        method: "DELETE",
      }),
    );
    expect(delRes.status).toBe(200);

    // Delete non-existent file
    const delNf = await adminPublicLibraryDelete(
      new Request("https://app.test/api/admin/public-library?path=notfound.css", {
        method: "DELETE",
      }),
    );
    expect(delNf.status).toBe(404);
  });
});

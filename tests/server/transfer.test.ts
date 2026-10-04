/**
 * Unit and integration tests for selective configuration transfer:
 * - lib/server/transfer/common.ts
 * - lib/server/transfer/read.ts
 * - lib/server/transfer/write.ts
 * - lib/server/transfer/handlers.ts
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "transfer-test-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "transfer-test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "transfer-test-encryption-key-32!";

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
  TRANSFER_FEATURES,
  TRANSFER_FIELDS,
  transferExport,
  transferImport,
} from "@/lib/server/transfer-routes";

let db: ReturnType<typeof getDb>;
let user: { id: number; username: string };
let projA: { id: number; name: string };
let projB: { id: number; name: string };
let userCookie: string;

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  user = await createUser("transferuser", "Password123!");
  projA = await createProject(user.id, "project-a");
  projB = await createProject(user.id, "project-b");
  userCookie = await createSession(user.id);
  sessionCookie = userCookie;

  // Populate project A with test data
  await db.run(
    `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, requires_auth, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projA.id, "/dashboard", "dash.html", 0, 1, 1],
  );
  await db.run(
    `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, requires_auth, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projA.id, "/api/status", null, 1, 0, 1],
  );
  await db.run(
    `INSERT INTO roles (project_id, name, permissions) VALUES (?, ?, ?)`,
    [projA.id, "CustomAuditor", '["db_read","audit_logs"]'],
  );
  await db.run(
    `INSERT INTO visitors (project_id, username, password_hash, role_id, is_active)
     VALUES (?, ?, ?, (SELECT id FROM roles WHERE project_id = ? AND name = 'CustomAuditor'), ?)`,
    [projA.id, "auditor_alice", "dummyhash", projA.id, 1],
  );
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

describe("Transfer metadata and constants", () => {
  it("defines expected features and field mappings", () => {
    expect(TRANSFER_FEATURES).toEqual(["routes", "secrets", "auth", "roles"]);
    expect(TRANSFER_FIELDS.routes).toContain("pathPattern");
    expect(TRANSFER_FIELDS.auth).toContain("username");
  });
});

describe("Selective configuration export (transferExport)", () => {
  it("exports routes, roles, and auth items", async () => {
    sessionCookie = userCookie;

    // Export routes
    const routesRes = await transferExport(get(`/api/transfer?projectId=${projA.id}&feature=routes`));
    expect(routesRes.status).toBe(200);
    const routesJson = await routesRes.json();
    expect(routesJson.items.length).toBe(3);
    expect(routesJson.ids).toContain("/dashboard");

    // Filter by ids
    const filterRes = await transferExport(
      get(`/api/transfer?projectId=${projA.id}&feature=routes&ids=/dashboard`),
    );
    expect(filterRes.status).toBe(200);
    const filterJson = await filterRes.json();
    expect(filterJson.items.length).toBe(1);
    expect(filterJson.ids).toEqual(["/dashboard"]);

    // Export roles
    const rolesRes = await transferExport(get(`/api/transfer?projectId=${projA.id}&feature=roles`));
    expect(rolesRes.status).toBe(200);
    const rolesJson = await rolesRes.json();
    expect(rolesJson.items.some((r: any) => r.name === "CustomAuditor")).toBe(true);

    // Export auth
    const authRes = await transferExport(get(`/api/transfer?projectId=${projA.id}&feature=auth`));
    expect(authRes.status).toBe(200);
    const authJson = await authRes.json();
    expect(authJson.items.some((v: any) => v.username === "auditor_alice")).toBe(true);
  });

  it("handles errors: invalid feature and non-existent ids", async () => {
    sessionCookie = userCookie;
    const badFeature = await transferExport(get(`/api/transfer?projectId=${projA.id}&feature=invalid`));
    expect(badFeature.status).toBe(400);

    const badIds = await transferExport(
      get(`/api/transfer?projectId=${projA.id}&feature=routes&ids=/nonexistent`),
    );
    expect(badIds.status).toBe(400);
  });
});

describe("Selective configuration import (transferImport)", () => {
  it("merges items into another project", async () => {
    sessionCookie = userCookie;

    // Merge routes from Proj A into Proj B
    const mergeRoutes = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "routes",
        mode: "merge",
        items: [
          {
            pathPattern: "/dashboard",
            targetFile: "dash.html",
            isProxy: false,
            requiresAuth: true,
            isActive: true,
          },
        ],
      }),
    );
    expect(mergeRoutes.status).toBe(200);
    const resJson = await mergeRoutes.json();
    expect(resJson.written).toBe(1);

    // Check project B has the route
    const checkRes = await transferExport(get(`/api/transfer?projectId=${projB.id}&feature=routes`));
    const checkJson = await checkRes.json();
    expect(checkJson.ids).toContain("/dashboard");
  });

  it("replaces items in a project", async () => {
    sessionCookie = userCookie;

    const replaceRes = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "routes",
        mode: "replace",
        items: [
          {
            pathPattern: "/new-route",
            targetFile: "new.html",
            isProxy: false,
            requiresAuth: false,
            isActive: true,
          },
        ],
      }),
    );
    expect(replaceRes.status).toBe(200);

    const checkRes = await transferExport(get(`/api/transfer?projectId=${projB.id}&feature=routes`));
    const checkJson = await checkRes.json();
    expect(checkJson.ids).toEqual(["/new-route"]);
  });

  it("copies visitors cross-project with automatic role propagation (copy-from)", async () => {
    sessionCookie = userCookie;

    // Copy visitor auditor_alice from Project A to Project B
    const copyRes = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "auth",
        mode: "copy-from",
        sourceProjectId: projA.id,
        ids: ["auditor_alice"],
      }),
    );
    expect(copyRes.status).toBe(200);
    const copyJson = await copyRes.json();
    expect(copyJson.visitors).toBe(1);
    expect(copyJson.rolesCreated).toContain("CustomAuditor");

    // Project B now has CustomAuditor role and auditor_alice visitor
    const rolesRes = await transferExport(get(`/api/transfer?projectId=${projB.id}&feature=roles`));
    const rolesJson = await rolesRes.json();
    expect(rolesJson.items.some((r: any) => r.name === "CustomAuditor")).toBe(true);

    const authRes = await transferExport(get(`/api/transfer?projectId=${projB.id}&feature=auth`));
    const authJson = await authRes.json();
    expect(authJson.items.some((u: any) => u.username === "auditor_alice")).toBe(true);
  });

  it("transfers secrets and roles with merge, replace, and updates", async () => {
    sessionCookie = userCookie;

    // 1. Secrets merge and replace
    const secMerge = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "secrets",
        mode: "merge",
        items: [{ key: "API_KEY", value: "secret-val-1" }],
      }),
    );
    expect(secMerge.status).toBe(200);

    // Update existing secret in merge mode
    const secUpdate = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "secrets",
        mode: "merge",
        items: [{ key: "API_KEY", value: "secret-val-2" }],
      }),
    );
    expect(secUpdate.status).toBe(200);

    // Replace secrets
    const secReplace = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "secrets",
        mode: "replace",
        items: [{ key: "NEW_SECRET", value: "secret-new" }],
      }),
    );
    expect(secReplace.status).toBe(200);

    // 2. Roles merge and replace
    const roleMerge = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "roles",
        mode: "merge",
        items: [{ name: "SupportStaff", permissions: ["db_read"] }],
      }),
    );
    expect(roleMerge.status).toBe(200);

    // Update existing role
    const roleUpdate = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "roles",
        mode: "merge",
        items: [{ name: "SupportStaff", permissions: ["db_read", "db_write"] }],
      }),
    );
    expect(roleUpdate.status).toBe(200);

    // 3. Auth visitor transfer
    // Non-existent role fails
    const badRoleVisitor = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "auth",
        mode: "merge",
        items: [{ username: "bob", role: "NonExistentRole", isActive: true }],
      }),
    );
    expect(badRoleVisitor.status).toBe(400);

    // Add valid visitor
    const validVisitor = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "auth",
        mode: "merge",
        items: [{ username: "bob", role: "Member", isActive: true }],
      }),
    );
    expect(validVisitor.status).toBe(200);

    // Update existing visitor
    const updateVisitor = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "auth",
        mode: "merge",
        items: [{ username: "bob", role: "SupportStaff", isActive: false }],
      }),
    );
    expect(updateVisitor.status).toBe(200);

    // Copy-from with visitor already in target updates existing visitor
    const copyAgain = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "auth",
        mode: "copy-from",
        sourceProjectId: projA.id,
        ids: ["auditor_alice"],
      }),
    );
    expect(copyAgain.status).toBe(200);

    // Copy roles via copy-from
    const copyRoles = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "roles",
        mode: "copy-from",
        sourceProjectId: projA.id,
        ids: ["CustomAuditor"],
      }),
    );
    expect(copyRoles.status).toBe(200);
  });

  it("validates input and throws 400 on malformed requests", async () => {
    sessionCookie = userCookie;

    // Missing sourceProjectId on copy-from
    const missingSource = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, { feature: "auth", mode: "copy-from" }),
    );
    expect(missingSource.status).toBe(400);

    // Unsupported feature for copy-from
    const unsupportedCopy = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, {
        feature: "routes",
        mode: "copy-from",
        sourceProjectId: projA.id,
      }),
    );
    expect(unsupportedCopy.status).toBe(400);

    // Empty items on merge
    const emptyMerge = await transferImport(
      post(`/api/transfer?projectId=${projB.id}`, { feature: "routes", mode: "merge", items: [] }),
    );
    expect(emptyMerge.status).toBe(400);
  });
});

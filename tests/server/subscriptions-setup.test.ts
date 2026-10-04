/**
 * Tests for Subscriptions and Deployment Setup Wizard modules:
 * - lib/server/subscriptions.ts
 * - lib/server/setup-wizard.ts
 * - app/api/subscription/plans/route.ts
 * - app/api/admin/subscriptions/plans/route.ts
 * - app/api/admin/setup/route.ts
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "subs-setup-test-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "subs-setup-test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "subs-setup-test-encryption-key-!";

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
import { createUser, getUserByUsername, listProjectsByUser } from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import {
  getSubscriptionPlans,
  saveSubscriptionPlans,
  invalidateSubscriptionPlansCache,
  DEFAULT_PLANS,
  type SubscriptionPlan,
} from "@/lib/server/subscriptions";
import {
  runSetupWizard,
  EXAMPLES_USERNAME,
} from "@/lib/server/setup-wizard";
import { GET as getPublicPlans } from "@/app/api/subscription/plans/route";
import {
  GET as getAdminPlans,
  PUT as putAdminPlans,
} from "@/app/api/admin/subscriptions/plans/route";
import {
  GET as getAdminSetup,
  POST as postAdminSetup,
} from "@/app/api/admin/setup/route";

let db: ReturnType<typeof getDb>;
let adminUser: { id: number; username: string };
let regularUser: { id: number; username: string };
let adminSessionCookie: string;
let regularSessionCookie: string;

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  adminUser = await createUser("superadmin", "Password123!");
  regularUser = await createUser("regularuser", "Password123!");

  await db.run("UPDATE users SET is_admin = 1 WHERE id = ?", [adminUser.id]);

  adminSessionCookie = await createSession(adminUser.id);
  regularSessionCookie = await createSession(regularUser.id);
});

afterAll(() => {
  db.close?.();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

describe("Subscription Plans Management", () => {
  it("returns DEFAULT_PLANS when no custom configuration is saved", async () => {
    const plans = await getSubscriptionPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.id)).toEqual(["free", "plus", "pro"]);
    expect(plans[0].priceToman).toBe(0);
    expect(plans[1].isPopular).toBe(true);
  });

  it("serves plans via public GET /api/subscription/plans route", async () => {
    const res = await getPublicPlans();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(3);
    expect(json.data[0].id).toBe("free");
  });

  it("denies access to GET /api/admin/subscriptions/plans without admin cookie", async () => {
    sessionCookie = regularSessionCookie;
    const req = new Request("http://localhost:3000/api/admin/subscriptions/plans");
    const res = await getAdminPlans(req);
    expect(res.status).toBe(403);
  });

  it("allows superadmin to retrieve and update subscription plans", async () => {
    sessionCookie = adminSessionCookie;
    const req = new Request("http://localhost:3000/api/admin/subscriptions/plans");
    const res = await getAdminPlans(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(3);

    // Update plans via PUT
    const updatedPlans: SubscriptionPlan[] = json.data.map((p: SubscriptionPlan) =>
      p.id === "plus" ? { ...p, priceToman: 120_000 } : p,
    );

    const putReq = new Request("http://localhost:3000/api/admin/subscriptions/plans", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plans: updatedPlans }),
    });

    const putRes = await putAdminPlans(putReq);
    expect(putRes.status).toBe(200);
    const putJson = await putRes.json();
    expect(putJson.success).toBe(true);

    // Verify cache updated immediately
    const livePlans = await getSubscriptionPlans();
    const plusPlan = livePlans.find((p) => p.id === "plus");
    expect(plusPlan?.priceToman).toBe(120_000);

    // Test in-memory cache hit (calling again within TTL)
    const cachedPlans = await getSubscriptionPlans();
    expect(cachedPlans).toBe(livePlans);
  });

  it("falls back to DEFAULT_PLANS if system_configs has malformed JSON or empty array", async () => {
    // Write malformed JSON
    await db.run("UPDATE system_configs SET config_value = ? WHERE config_key = ?", [
      "not-valid-json",
      "subscription.plans",
    ]);
    const { invalidateConfig } = await import("@/lib/server/system-config");
    invalidateConfig("subscription.plans");
    invalidateSubscriptionPlansCache();

    // Clear memory cache by saving and then tampering
    const fallbackPlans = await getSubscriptionPlans();
    expect(fallbackPlans).toHaveLength(3);
    expect(fallbackPlans[0].id).toBe("free");

    // Write empty array
    await db.run("UPDATE system_configs SET config_value = ? WHERE config_key = ?", [
      "[]",
      "subscription.plans",
    ]);
    invalidateConfig("subscription.plans");
    invalidateSubscriptionPlansCache();
    const emptyFallback = await getSubscriptionPlans();
    expect(emptyFallback).toEqual(DEFAULT_PLANS);
  });

  it("handles inserting new row when system_configs row does not exist", async () => {
    await db.run("DELETE FROM system_configs WHERE config_key = ?", ["subscription.plans"]);
    await saveSubscriptionPlans(DEFAULT_PLANS);
    const plans = await getSubscriptionPlans();
    expect(plans).toHaveLength(3);
  });

  it("rejects invalid body on PUT /api/admin/subscriptions/plans", async () => {
    sessionCookie = adminSessionCookie;
    const badReq = new Request("http://localhost:3000/api/admin/subscriptions/plans", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await putAdminPlans(badReq);
    expect(res.status).toBe(400);

    const nonArrayReq = new Request("http://localhost:3000/api/admin/subscriptions/plans", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plans: "invalid" }),
    });
    const res2 = await putAdminPlans(nonArrayReq);
    expect(res2.status).toBe(400);
  });
});

describe("Deployment Setup Wizard & Seeding", () => {
  it("checks initial setup status before wizard execution", async () => {
    sessionCookie = adminSessionCookie;
    const req = new Request("http://localhost:3000/api/admin/setup");
    const res = await getAdminSetup(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.wizardCompleted).toBe(false);
    expect(json.data.examplesUserExists).toBe(false);
    expect(json.data.exampleProjectsCount).toBe(0);
  });

  it("runs the setup wizard to seed demo data and showcase projects non-destructively", async () => {
    sessionCookie = adminSessionCookie;
    const postReq = new Request("http://localhost:3000/api/admin/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedDemoData: true, seedExampleProjects: true }),
    });

    const res = await postAdminSetup(postReq);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.createdExamplesUser).toBe(true);
    expect(json.result.createdProjects).toContain("cake-shop");
    expect(json.result.createdProjects).toContain("profile-links");
    expect(json.status.wizardCompleted).toBe(true);
    expect(json.status.examplesUserExists).toBe(true);
    expect(json.status.exampleProjectsCount).toBe(5);

    // Verify showcase user and projects exist in DB
    const examplesUser = await getUserByUsername(EXAMPLES_USERNAME);
    expect(examplesUser).not.toBeNull();
    const projs = await listProjectsByUser(examplesUser!.id);
    const names = projs.map((p) => p.name);
    expect(names).toContain("cake-shop");
    expect(names).toContain("todo-tasks");
    expect(names).toContain("guestbook");
    expect(names).toContain("feedback-poll");
    expect(names).toContain("profile-links");
  });

  it("is strictly idempotent: running setup wizard again preserves data without duplicating projects", async () => {
    sessionCookie = adminSessionCookie;
    const postReq = new Request("http://localhost:3000/api/admin/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedDemoData: true, seedExampleProjects: true }),
    });

    const res = await postAdminSetup(postReq);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // User already exists, projects already exist
    expect(json.result.createdExamplesUser).toBe(false);
    expect(json.result.createdProjects).toHaveLength(0);
    expect(json.status.exampleProjectsCount).toBe(5);
  });

  it("supports running setup wizard with partial options (no-op seeds)", async () => {
    const partialResult = await runSetupWizard({
      seedDemoData: false,
      seedExampleProjects: false,
    });
    expect(partialResult.success).toBe(true);
    expect(partialResult.seededPlans).toBe(false);
    expect(partialResult.createdProjects).toHaveLength(0);
  });

  it("denies regular users access to GET and POST /api/admin/setup", async () => {
    sessionCookie = regularSessionCookie;
    const getReq = new Request("http://localhost:3000/api/admin/setup");
    const getRes = await getAdminSetup(getReq);
    expect(getRes.status).toBe(403);

    const postReq = new Request("http://localhost:3000/api/admin/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedDemoData: true }),
    });
    const postRes = await postAdminSetup(postReq);
    expect(postRes.status).toBe(403);
  });
});

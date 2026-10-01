/**
 * Platform completion suite (feat/complete-platform): the features added in the
 * "finish the partial implementations" pass — captcha-gated logins, account
 * lockout, system config, operator/admin APIs, account + project updates,
 * custom domains, named endpoint toggles, cron rollup/retry/audit, document
 * webhook dispatch, /library serving, backup ZIP export, and the serving
 * rate limit + HTML-only visit counting.
 *
 * Session-scoped endpoints are exercised by swapping the packed cookie the
 * mocked next/headers cookies() returns.
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { createHmac } from "node:crypto";

const tmp = mkdtempSync(join(tmpdir(), "platform-completion-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";

/** Packed session cookie read lazily by the mocked cookies(). */
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
  assertNotLocked,
  authenticateUser,
  changePassword,
  createApiKey,
  createProject,
  createUser,
  getUserById,
  updateEmail,
  updateProject,
  putFile,
  ensureLibraryProject,
} from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import { createCaptchaChallenge, verifyCaptcha } from "@/lib/server/captcha";
import { SYSTEM_CONFIG_DEFAULTS, configAll, configNumber } from "@/lib/server/system-config";
import {
  adminConfigGet,
  adminConfigSet,
  adminStats,
  adminUsersList,
  adminUsersPatch,
} from "@/lib/server/admin-routes";
import {
  consoleDomainsCreate,
  consoleDomainsDelete,
  consoleDomainsList,
  consoleDomainsVerify,
  consoleEndpointsList,
  consoleEndpointsToggle,
  consoleStorageExport,
  consoleUsage,
} from "@/lib/server/console-routes";
import { dbFind, dbInsert } from "@/lib/server/db-routes";
import {
  rollupDailyStats,
  retryFailedWebhooks,
  storageAudit,
} from "@/lib/server/cron-routes";
import { checkRateLimitForIdentity } from "@/lib/server/ratelimit";
import { dispatchWebhookEvent } from "@/lib/server/webhook-routes";
import { invalidateConfig } from "@/lib/server/system-config";
import { compileFilter } from "@/lib/server/db/dsl";
import { buildZip } from "@/lib/server/zip";
import { resolveProjectByDomain, serveProjectRequest } from "@/lib/server/serving";
import { storageUpload } from "@/lib/server/storage-routes";

let db: ReturnType<typeof getDb>;
let owner: { id: number; username: string };
let stranger: { id: number; username: string };
let admin: { id: number; username: string };
let project: { id: number; name: string };
let adminSession = "";
let ownerSession = "";
let strangerSession = "";
let apiKey = "";
const NO_CONTEXT = { params: Promise.resolve({}) };
const authHeaders = () => ({ authorization: `Bearer ${apiKey}` });

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  owner = await createUser("completionowner", "password123");
  stranger = await createUser("completionstranger", "password123");
  admin = await createUser("completionadmin", "password123");
  await db.run(
    `UPDATE users SET is_admin = ${placeholder(db.driver, 0)} WHERE id = ${placeholder(db.driver, 1)}`,
    [1, admin.id],
  );

  project = await createProject(owner.id, "completionsite");
  // The webhook receiver in this suite is a local HTTP server, which the SSRF
  // guard rejects by default. The opt-in switch is what a self-hosted
  // deployment would set.
  await setSystemConfig(db, "webhooks.allow_private_targets", true);
  const created = await createApiKey(owner.id, project.id, "completionkey");
  apiKey = created.key;

  await putFile(owner.id, project.id, "index.html", Buffer.from("<html><body>Hello</body></html>"), false);
  await putFile(owner.id, project.id, "style.css", Buffer.from("body{color:red}"), false);
  // The shared library is the account's reserved `library` project, so its
  // assets are stored there under their real path and served from
  // /{username}/library/<path> (see the library CDN test below).
  const library = await ensureLibraryProject(owner.id);
  await putFile(owner.id, library.id, "theme.css", Buffer.from(".x{color:blue}"), true);

  adminSession = await createSession(admin.id);
  ownerSession = await createSession(owner.id);
  strangerSession = await createSession(stranger.id);
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

function patch(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${url}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------- captcha

describe("captcha challenge", () => {
  it("round-trips a signed challenge and rejects tampered or expired ids", () => {
    const { id, svg } = createCaptchaChallenge();
    const answer = id.split(".")[1]!;
    expect(svg).toContain("<svg");
    expect(verifyCaptcha(id, answer)).toBe(true);

    // Wrong answer, missing fields, and a forged mac all fail.
    expect(verifyCaptcha(id, String(Number(answer) + 1))).toBe(false);
    expect(verifyCaptcha(id, undefined)).toBe(false);
    expect(verifyCaptcha(undefined, answer)).toBe(false);
    expect(verifyCaptcha(`${id}x`, answer)).toBe(false);

    // An expired (but otherwise well-formed) id fails.
    const payload = `${Date.now() - 60_000}.7`;
    const expired = `${payload}.${createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url")}`;
    expect(verifyCaptcha(expired, "7")).toBe(false);
  });

  it("serves a fresh challenge from GET /auth/captcha", async () => {
    const { GET } = await import("@/app/auth/captcha/route");
    const response = await GET(get("/auth/captcha"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { challengeId: string; svg: string };
    expect(body.svg).toContain("= ?");
    expect(verifyCaptcha(body.challengeId, body.challengeId.split(".")[1]!)).toBe(true);
  });
});

// ---------------------------------------------------------------- lockout

describe("account lockout", () => {
  it("locks the account after max failed logins and clears on success", async () => {
    await createUser("lockouttarget", "correct-horse");
    await assertNotLocked("lockouttarget"); // not locked yet

    for (let i = 0; i < 5; i++) {
      await expect(authenticateUser("lockouttarget", "wrong")).rejects.toThrow();
    }
    await expect(assertNotLocked("lockouttarget")).rejects.toThrow(/locked/i);

    const rows = await db.raw<{ locked_until: string | null }>(
      "SELECT locked_until FROM users WHERE username = 'lockouttarget'",
    );
    expect(rows[0]?.locked_until).toBeTruthy();

    // A successful login clears the streak and any (expired) lockout.
    await createUser("lockoutpartial", "correct-horse");
    await expect(authenticateUser("lockoutpartial", "wrong")).rejects.toThrow();
    await authenticateUser("lockoutpartial", "correct-horse");
    const partial = await db.raw<{ failed_login_count: number; locked_until: string | null }>(
      "SELECT failed_login_count, locked_until FROM users WHERE username = 'lockoutpartial'",
    );
    expect(Number(partial[0]?.failed_login_count)).toBe(0);
    expect(partial[0]?.locked_until).toBeNull();
  });

  it("resuming an account through the admin API clears its lockout", async () => {
    sessionCookie = adminSession;
    const locked = await db.raw<{ id: number }>(
      "SELECT id FROM users WHERE username = 'lockouttarget'",
    );
    const response = await adminUsersPatch(
      patch("/api/admin/users", { userId: Number(locked[0]!.id), isSuspended: false }),
      NO_CONTEXT,
    );
    expect(response.status).toBe(200);
    const after = await db.raw<{ locked_until: string | null }>(
      "SELECT locked_until FROM users WHERE username = 'lockouttarget'",
    );
    expect(after[0]?.locked_until).toBeNull();
  });
});

// ---------------------------------------------------------------- system config

describe("system config", () => {
  it("falls back to defaults and validates keys", async () => {
    expect(SYSTEM_CONFIG_DEFAULTS["auth.max_login_attempts"]).toBe(5);
    expect(await configNumber("auth.max_login_attempts", 5)).toBe(5);
    expect(await configNumber("not.a.real.key", 42)).toBe(42);
    const all = await configAll();
    expect(all["visits.dedupe_window_seconds"]).toBe(300);
  });

  it("requires an admin session", async () => {
    sessionCookie = strangerSession;
    expect((await adminStats(get("/api/admin"), NO_CONTEXT)).status).toBe(403);
    expect((await adminUsersList(get("/api/admin/users"), NO_CONTEXT)).status).toBe(403);
    expect(
      (await adminConfigSet(post("/api/admin/config", { key: "auth.max_login_attempts", value: 2 }), NO_CONTEXT)).status,
    ).toBe(403);
  });

  it("reads and writes config as an admin, rejecting unknown keys", async () => {
    sessionCookie = adminSession;
    const put = await adminConfigSet(
      post("/api/admin/config", { key: "auth.max_login_attempts", value: 3 }),
      NO_CONTEXT,
    );
    expect(put.status).toBe(200);
    expect(await configNumber("auth.max_login_attempts", 5)).toBe(3);

    const read = await adminConfigGet(get("/api/admin/config"), NO_CONTEXT);
    const body = (await read.json()) as {
      data: Record<string, unknown>;
      defaults: Record<string, unknown>;
      tree: Record<string, Record<string, unknown>>;
    };
    expect(body.data["auth.max_login_attempts"]).toBe(3);
    expect(body.defaults["auth.max_login_attempts"]).toBe(5);
    expect(body.tree.auth?.max_login_attempts).toBe(3);

    const unknown = await adminConfigSet(
      post("/api/admin/config", { key: "nope", value: 1 }),
      NO_CONTEXT,
    );
    expect(unknown.status).toBe(400);

    // Restore the default so the lockout tests keep their documented budget.
    await adminConfigSet(post("/api/admin/config", { key: "auth.max_login_attempts", value: 5 }), NO_CONTEXT);
  });

  it("reports platform stats and lists users", async () => {
    sessionCookie = adminSession;
    const stats = await adminStats(get("/api/admin"), NO_CONTEXT);
    const statsBody = (await stats.json()) as { users: number; projects: number };
    expect(statsBody.users).toBeGreaterThanOrEqual(3);
    expect(statsBody.projects).toBeGreaterThanOrEqual(1);

    const users = await adminUsersList(get("/api/admin/users"), NO_CONTEXT);
    const usersBody = (await users.json()) as { data: Array<{ username: string; isAdmin: boolean }> };
    expect(usersBody.data.find((u) => u.username === "completionadmin")?.isAdmin).toBe(true);
    expect(usersBody.data.every((u) => "lockedUntil" in u)).toBe(true);
  });

  it("updates a user's storage cap and rejects empty patches", async () => {
    sessionCookie = adminSession;
    const ok = await adminUsersPatch(
      patch("/api/admin/users", { userId: stranger.id, storageCapBytes: 1_000_000 }),
      NO_CONTEXT,
    );
    expect(ok.status).toBe(200);
    expect((await getUserById(stranger.id))?.storageCapBytes).toBe(1_000_000);

    const empty = await adminUsersPatch(
      patch("/api/admin/users", { userId: stranger.id }),
      NO_CONTEXT,
    );
    expect(empty.status).toBe(400);
  });
});

// ---------------------------------------------------------------- account

describe("account updates", () => {
  it("changes the password and rejects a wrong current one", async () => {
    const { PATCH } = await import("@/app/api/account/route");
    sessionCookie = strangerSession;
    const bad = await PATCH(
      patch("/api/account", { currentPassword: "nope", newPassword: "new-password-1" }),
      NO_CONTEXT,
    );
    expect(bad.status).toBe(401);

    const ok = await PATCH(
      patch("/api/account", { currentPassword: "password123", newPassword: "new-password-1" }),
      NO_CONTEXT,
    );
    expect(ok.status).toBe(200);
    await expect(authenticateUser("completionstranger", "new-password-1")).resolves.toBeTruthy();

    await expect(changePassword(stranger.id, "new-password-1", "short")).rejects.toThrow();
  });

  it("rejects an email already in use", async () => {
    await updateEmail(owner.id, "owner@example.com");
    await expect(updateEmail(stranger.id, "owner@example.com")).rejects.toThrow(/already in use/i);
    expect((await getUserById(owner.id))?.email).toBe("owner@example.com");
  });
});

// ---------------------------------------------------------------- project patch

describe("project updates", () => {
  it("renames, suspends, and toggles the watermark through PATCH", async () => {
    const { PATCH } = await import("@/app/api/projects/[projectId]/route");
    sessionCookie = ownerSession;
    const response = await PATCH(
      patch(`/api/projects/${project.id}`, { watermarkEnabled: false, isActive: true }),
      { params: Promise.resolve({ projectId: String(project.id) }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { watermarkEnabled: boolean } };
    expect(body.data.watermarkEnabled).toBe(false);

    const renamed = await updateProject(owner.id, project.id, { name: "renamed-site" });
    expect(renamed.name).toBe("renamed-site");
    await updateProject(owner.id, project.id, { name: project.name, watermarkEnabled: true });

    await expect(updateProject(owner.id, project.id, { name: "Bad Name!" })).rejects.toThrow(/Project name/);
  });
});

// ---------------------------------------------------------------- dsl

describe("filter DSL", () => {
  it("compiles $nor as Mongo's NOT(OR) and matches nothing when empty", () => {
    const negated = compileFilter({ $nor: [{ status: "banned" }, { status: "hidden" }] }, "sqlite");
    expect(negated.sql).toContain("NOT (");
    expect(negated.sql).toContain("OR");

    const empty = compileFilter({ $nor: [] }, "sqlite");
    expect(empty.sql).toBe("1 = 1");
  });
});

// ---------------------------------------------------------------- domains

describe("custom domains", () => {
  it("attaches, lists, verifies, and deletes a domain", async () => {
    sessionCookie = ownerSession;
    const created = await consoleDomainsCreate(
      post(`/api/domains?projectId=${project.id}`, { domain: "verify-unique.example.invalid" }),
      NO_CONTEXT,
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      verificationToken: string;
      dns: { name: string; type: string; value: string };
    };
    expect(createdBody.verificationToken).toMatch(/^localme-verify=[0-9a-f]{32}$/);
    expect(createdBody.dns.name).toBe("_localme-verify.verify-unique.example.invalid");
    expect(createdBody.dns.type).toBe("TXT");

    const duplicate = await consoleDomainsCreate(
      post(`/api/domains?projectId=${project.id}`, { domain: "verify-unique.example.invalid" }),
      NO_CONTEXT,
    );
    expect(duplicate.status).toBe(409);

    const invalid = await consoleDomainsCreate(
      post(`/api/domains?projectId=${project.id}`, { domain: "not a domain" }),
      NO_CONTEXT,
    );
    expect(invalid.status).toBe(400);

    const listed = await consoleDomainsList(get(`/api/domains?projectId=${project.id}`), NO_CONTEXT);
    const listedBody = (await listed.json()) as { data: Array<{ domain: string; isVerified: boolean; id: number }> };
    const attached = listedBody.data.find((d) => d.domain === "verify-unique.example.invalid")!;
    expect(attached.isVerified).toBe(false);

    // Unverified domains never resolve.
    expect(await resolveProjectByDomain("verify-unique.example.invalid")).toBeNull();

    const verify = await consoleDomainsVerify(
      post(`/api/domains/verify?projectId=${project.id}&domain=verify-unique.example.invalid`, {}),
      NO_CONTEXT,
    );
    const verifyBody = (await verify.json()) as { verified: boolean };
    expect(verifyBody.verified).toBe(false);

    const unknown = await consoleDomainsVerify(
      post(`/api/domains/verify?projectId=${project.id}&domain=never-attached.example.invalid`, {}),
      NO_CONTEXT,
    );
    expect(unknown.status).toBe(404);

    // A verified domain resolves to its project (and serves through _domain).
    await db.run(
      `UPDATE domains SET is_verified = ${placeholder(db.driver, 0)} WHERE id = ${placeholder(db.driver, 1)}`,
      [1, attached.id],
    );
    const resolved = await resolveProjectByDomain("verify-unique.example.invalid");
    expect(resolved?.projectId).toBe(project.id);

    const served = await serveProjectRequest(
      get("/", { "x-real-ip": "203.0.113.7" }),
      { user: "_domain", project: "verify-unique.example.invalid", path: "/" },
    );
    expect(served.status).toBe(200);
    expect(await served.text()).toContain("Hello");

    const removed = await consoleDomainsDelete(
      new Request(`https://app.test/api/domains/${attached.id}?projectId=${project.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ domainId: String(attached.id) }) },
    );
    expect(removed.status).toBe(200);
    const missing = await consoleDomainsDelete(
      new Request(`https://app.test/api/domains/${attached.id}?projectId=${project.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ domainId: String(attached.id) }) },
    );
    expect(missing.status).toBe(404);
  });
});

// ---------------------------------------------------------------- endpoints

describe("named API endpoints", () => {
  it("refuses disabled endpoints with 403 and allows re-enabled ones", async () => {
    sessionCookie = ownerSession;
    const off = await consoleEndpointsToggle(
      new Request(`https://app.test/api/endpoints?projectId=${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "db.find", isEnabled: false }),
      }),
      NO_CONTEXT,
    );
    expect(off.status).toBe(200);

    const listed = await consoleEndpointsList(get(`/api/endpoints?projectId=${project.id}`), NO_CONTEXT);
    const listedBody = (await listed.json()) as { data: Array<{ endpoint: string; isEnabled: boolean }> };
    expect(listedBody.data.find((e) => e.endpoint === "db.find")?.isEnabled).toBe(false);

    const blocked = await dbFind(post(`/api/db/find?projectId=${project.id}`, { table: "todos" }, authHeaders()), NO_CONTEXT);
    expect(blocked.status).toBe(403);

    await consoleEndpointsToggle(
      new Request(`https://app.test/api/endpoints?projectId=${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "db.find", isEnabled: true }),
      }),
      NO_CONTEXT,
    );
    const allowed = await dbFind(post(`/api/db/find?projectId=${project.id}`, { table: "todos" }, authHeaders()), NO_CONTEXT);
    expect(allowed.status).toBe(200);
  });
});

// ---------------------------------------------------------------- webhooks

describe("document webhooks", () => {
  it("dispatches document.created on insert", async () => {
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
         VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, 'whsec_test', ${placeholder(db.driver, 2)}, 1)`,
        [project.id, `http://127.0.0.1:${port}/hook`, JSON.stringify(["document.created"])],
      );

      const inserted = await dbInsert(
        post(`/api/db/insert?projectId=${project.id}`, { table: "notes", document: { id: "n1", text: "hi" } }, authHeaders()),
        NO_CONTEXT,
      );
      expect(inserted.status).toBe(201);

      for (let i = 0; i < 40 && received === 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(received).toBeGreaterThanOrEqual(1);
    } finally {
      server.close();
    }
  });
});

// ---------------------------------------------------------------- cron

describe("cron tasks", () => {
  it("rolls yesterday's visits into daily_project_stats idempotently", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await db.run(
      `INSERT INTO visit_logs (project_id, route, ip, visited_at, is_unique) VALUES (${placeholder(db.driver, 0)}, 'index.html', '10.0.0.1', ?, 1)`,
      [project.id, `${yesterday}T10:00:00.000Z`],
    );

    const first = await rollupDailyStats(project.id);
    expect(first.date).toBe(yesterday);
    expect(Number(first.totalVisits)).toBeGreaterThanOrEqual(1);

    // Second run updates the same row instead of duplicating it.
    await rollupDailyStats(project.id);
    const rows = await db.raw<{ n: number }>(
      `SELECT COUNT(*) AS n FROM daily_project_stats WHERE project_id = ${placeholder(db.driver, 0)} AND date = ${placeholder(db.driver, 1)}`,
      [project.id, yesterday],
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it("parks failed deliveries and only retries them when the operator opts in (§5.9)", async () => {
    let hits = 0;
    let failing = true;
    const server = createServer((_req, res) => {
      hits += 1;
      if (failing) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("boom");
        return;
      }
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      await db.run(
        `INSERT INTO webhooks (project_id, url, secret, events, is_active)
         VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, 'whsec_retry', ${placeholder(db.driver, 2)}, 1)`,
        [project.id, `http://127.0.0.1:${port}/retry`, JSON.stringify(["document.created"])],
      );
      const webhook = await db.raw<{ id: number }>(
        `SELECT id FROM webhooks WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id DESC LIMIT 1`,
        [project.id],
      );

      // Dispatch enqueues, then drains inline: the 500 parks the row in `failed`.
      const first = await dispatchWebhookEvent(project.id, "document.created", { id: "doc-retry" });
      // Another webhook from an earlier test may also subscribe, so assert on
      // this project's queue rather than an exact global count.
      expect(first.delivered).toBeGreaterThanOrEqual(1);
      expect(hits).toBe(1);
      const parked = await db.raw<{ status: string; attempts: number }>(
        `SELECT status, attempts FROM webhook_outbox WHERE webhook_id = ${placeholder(db.driver, 0)}`,
        [webhook[0]!.id],
      );
      expect(parked[0]!.status).toBe("failed");
      expect(Number(parked[0]!.attempts)).toBe(1);

      // Spec default: no retries, so another drain must not re-attempt.
      const noRetry = await retryFailedWebhooks(project.id);
      expect(Number(noRetry.attempted)).toBe(0);
      expect(hits).toBe(1);

      // Opt in, and the parked row is re-queued and delivered.
      await db.run(
        `INSERT INTO system_configs (config_key, config_value) VALUES ('webhooks.retry_failed', 'true')
         ON CONFLICT (config_key) DO UPDATE SET config_value = 'true'`,
      );
      invalidateConfig();
      failing = false;
      try {
        const retried = await retryFailedWebhooks(project.id);
        // Every parked row for the project is re-queued, including the dead
        // endpoint an earlier test left behind, so assert on this webhook.
        expect(Number(retried.attempted)).toBeGreaterThanOrEqual(1);
        expect(Number(retried.delivered)).toBeGreaterThanOrEqual(1);
        expect(hits).toBe(2);
        const settled = await db.raw<{ status: string }>(
          `SELECT status FROM webhook_outbox WHERE webhook_id = ${placeholder(db.driver, 0)}`,
          [webhook[0]!.id],
        );
        expect(settled[0]!.status).toBe("delivered");
      } finally {
        await db.run(
          `UPDATE system_configs SET config_value = 'false' WHERE config_key = 'webhooks.retry_failed'`,
        );
        invalidateConfig();
      }
    } finally {
      server.close();
    }
  });

  it("audits storage without drift", async () => {
    const audit = await storageAudit(project.id);
    expect(Number(audit.files)).toBeGreaterThanOrEqual(3);
    expect(Number(audit.bytes)).toBeGreaterThan(0);
    expect(typeof audit.auditedAt).toBe("string");
  });
});

// ---------------------------------------------------------------- usage + export

describe("usage and backup export", () => {
  it("reports daily stats, monthly visits, and storage", async () => {
    sessionCookie = ownerSession;
    const response = await consoleUsage(get(`/api/usage?projectId=${project.id}`), NO_CONTEXT);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ date: string; visits: number }>;
      thisMonth: number;
      freeVisitsPerMonth: number;
      storageUsed: number;
    };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.freeVisitsPerMonth).toBeGreaterThan(0);
    expect(body.storageUsed).toBeGreaterThan(0);
  });

  it("exports the project as a valid ZIP archive", async () => {
    sessionCookie = ownerSession;
    const response = await consoleStorageExport(get(`/api/storage/export?projectId=${project.id}`), NO_CONTEXT);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");

    const zip = Buffer.from(await response.arrayBuffer());
    const entries = readZipEntries(zip);
    const index = entries.find((e) => e.path === "index.html");
    expect(index).toBeDefined();
    expect(index!.crc).toBe(crc32("<html><body>Hello</body></html>"));
    expect(index!.size).toBe(Buffer.byteLength("<html><body>Hello</body></html>"));
  });

  it("builds store-only archives with correct CRCs and UTF-8 names", () => {
    const content = Buffer.from("hello world");
    const zip = buildZip([{ path: "café/hello.txt", content }]);
    const entries = readZipEntries(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.path).toBe("café/hello.txt");
    expect(entries[0]!.crc).toBe(crc32(content));
    expect(entries[0]!.size).toBe(content.byteLength);
  });
});

// ---------------------------------------------------------------- serving

describe("serving guards", () => {
  it("rate-limits per IP per window", async () => {
    const identity = `serve:198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    expect((await checkRateLimitForIdentity(identity, "default", 2)).allowed).toBe(true);
    expect((await checkRateLimitForIdentity(identity, "default", 2)).allowed).toBe(true);
    const third = await checkRateLimitForIdentity(identity, "default", 2);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns 429 from serving once the per-IP budget is spent", async () => {
    const ip = "198.51.100.250";
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    await db.run(
      `INSERT INTO rate_limits (session_id, route_pattern, window_start, request_count) VALUES (${placeholder(db.driver, 0)}, 'default', ${placeholder(db.driver, 1)}, 120)`,
      [`serve:${ip}`, windowStart],
    );
    const response = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`, { "x-real-ip": ip }),
      { user: owner.username, project: project.name, path: "/" },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("logs visits for HTML pages only and caches assets long", async () => {
    const before = await visitCount();
    const html = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`, { "x-real-ip": "198.51.100.11" }),
      { user: owner.username, project: project.name, path: "/" },
    );
    expect(html.status).toBe(200);
    expect(html.headers.get("cache-control")).toBe("no-store");
    expect(await visitCount()).toBe(before + 1);

    const css = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/style.css`, { "x-real-ip": "198.51.100.12" }),
      { user: owner.username, project: project.name, path: "/style.css" },
    );
    expect(css.status).toBe(200);
    expect(css.headers.get("cache-control")).toContain("max-age=86400");
    expect(await visitCount()).toBe(before + 1);
  });

  it("injects the watermark unless the project opts out", async () => {
    await updateProject(owner.id, project.id, { watermarkEnabled: true });
    const withMark = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`, { "x-real-ip": "198.51.100.13" }),
      { user: owner.username, project: project.name, path: "/" },
    );
    expect(await withMark.text()).toContain("MVP Platform");

    await updateProject(owner.id, project.id, { watermarkEnabled: false });
    const without = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`, { "x-real-ip": "198.51.100.14" }),
      { user: owner.username, project: project.name, path: "/" },
    );
    expect(await without.text()).not.toContain("MVP Platform");
    await updateProject(owner.id, project.id, { watermarkEnabled: true });
  });

  it("serves shared library assets as a CDN and blocks traversal + HTML", async () => {
    // The public URL is /{username}/library/<path>; it must not be billed as a
    // visit or watermarked, and it is reachable with no session at all.
    const served = await serveProjectRequest(
      get(`/${owner.username}/library/theme.css`),
      { user: owner.username, project: "library", path: "/theme.css" },
    );
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(served.headers.get("cache-control")).toContain("max-age=86400");
    expect(await served.text()).toBe(".x{color:blue}");

    // Referenced from inside a project by its reserved folder name.
    const referenced = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/library/theme.css`),
      { user: owner.username, project: project.name, path: "/library/theme.css" },
    );
    expect(referenced.status).toBe(200);
    expect(await referenced.text()).toBe(".x{color:blue}");

    const missing = await serveProjectRequest(
      get(`/${owner.username}/library/missing.css`),
      { user: owner.username, project: "library", path: "/missing.css" },
    );
    expect(missing.status).toBe(404);

    // HTML would run against the console session on the platform origin.
    const html = await serveProjectRequest(
      get(`/${owner.username}/library/evil.html`),
      { user: owner.username, project: "library", path: "/evil.html" },
    );
    expect(html.status).toBe(404);

    const traversal = await serveProjectRequest(
      get(`/${owner.username}/library/../secret`),
      { user: owner.username, project: "library", path: "/../secret" },
    );
    expect(traversal.status).toBe(404);
  });

  it("refuses to let a project squat the reserved library folder", async () => {
    sessionCookie = ownerSession;
    const response = await storageUpload(
      new Request(`https://app.test/api/storage?projectId=${project.id}&path=library/theme.css`, {
        method: "POST",
        headers: { "content-type": "text/css" },
        body: "body{}",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "bad_request" });
  });

  it("refuses to create a project named library", async () => {
    await expect(createProject(owner.id, "library")).rejects.toMatchObject({ code: "bad_request" });
  });
});

async function visitCount(): Promise<number> {
  const rows = await db.raw<{ n: number }>(
    `SELECT COUNT(*) AS n FROM visit_logs WHERE project_id = ${placeholder(db.driver, 0)}`,
    [project.id],
  );
  return Number(rows[0]?.n ?? 0);
}

/** Parse a ZIP's central directory into `{ path, crc, size }` entries. */
function readZipEntries(zip: Buffer): Array<{ path: string; crc: number; size: number }> {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entries: Array<{ path: string; crc: number; size: number }> = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(cursor + 16);
    const size = zip.readUInt32LE(cursor + 24);
    const nameLen = zip.readUInt16LE(cursor + 28);
    const extraLen = zip.readUInt16LE(cursor + 30);
    const commentLen = zip.readUInt16LE(cursor + 32);
    const path = zip.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    entries.push({ path, crc, size });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}


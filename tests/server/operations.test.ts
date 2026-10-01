/**
 * Coverage for the operations pass: structured logging (§9.4), the asset cache
 * and conditional requests (§8.1), per-project write serialization (§8.4), cron
 * schedules (Tech docs §8), minification on save and upload bounds (§8.3), and
 * ACME certificate provisioning for custom domains (§5.6).
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "operations-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";
process.env.NEXT_PUBLIC_SITE_URL = "https://app.test";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "localme_session" && sessionCookie ? { value: sessionCookie } : undefined,
    }),
}));

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { createProject, createUser } from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import { createDocumentStore } from "@/lib/server/db/documents";
import { serveProjectRequest } from "@/lib/server/serving";
import { storageUpload } from "@/lib/server/storage-routes";
import { createApiKey } from "@/lib/server/repos";
import { cronList, cronToggle, runCronTask } from "@/lib/server/cron-routes";
import { nextRunAtFor } from "@/lib/server/cron-tasks";
import {
  describeSchedule,
  nextCronRun,
  parseCronExpression,
  scheduleFromParameters,
  scheduleIsReachable,
} from "@/lib/server/cron-schedule";
import { createLogger, redactFields, redactValue, resetLoggerCache } from "@/lib/server/logger";
import {
  assetCacheStats,
  clearAssetCache,
  configureAssetCache,
  etagFor,
  getCachedAsset,
  invalidateAsset,
  setCachedAsset,
} from "@/lib/server/asset-cache";
import { isWriteLockIdle, withProjectWriteLock } from "@/lib/server/write-lock";
import {
  domainsNeedingRenewal,
  getAcmeChallenge,
  provisionCertificate,
  purgeExpiredChallenges,
  putAcmeChallenge,
  renewExpiringCertificates,
  sslStatus,
  type AcmeIssuer,
} from "@/lib/server/ssl";
import { getCertificate } from "@/lib/server/ssl";
import { invalidateConfig } from "@/lib/server/system-config";

let db: ReturnType<typeof getDb>;
let owner: { id: number; username: string };
let project: { id: number; name: string };
let ownerSession = "";
const NO_CONTEXT = { params: Promise.resolve({}) };

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  owner = await createUser("opsowner", "password123");
  project = await createProject(owner.id, "opsapp");
  ownerSession = await createSession(owner.id);
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function setConfig(key: string, value: unknown): Promise<void> {
  const encoded = JSON.stringify(value);
  // Two statements instead of an upsert: SQLite placeholders are positional, so
  // repeating one inside ON CONFLICT would need the value twice.
  return db
    .run(
      `UPDATE system_configs SET config_value = ${placeholder(db.driver, 0)}, updated_at = ${placeholder(db.driver, 1)}
       WHERE config_key = ${placeholder(db.driver, 2)}`,
      [encoded, new Date().toISOString(), key],
    )
    .then((result) =>
      result.changes > 0
        ? undefined
        : db.run(
            `INSERT INTO system_configs (config_key, config_value) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)})`,
            [key, encoded],
          ),
    )
    .then(() => {
      invalidateConfig(key);
    });
}

/** Raw-body POST — storage uploads send the file bytes, not JSON. */
function postRaw(url: string, body: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${url}`, {
    method: "POST",
    headers: { "content-type": "text/plain", ...headers },
    body,
  });
}

function get(url: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${url}`, { headers });
}

// ---------------------------------------------------------------- §9.4 logging

describe("structured logging (§9.4)", () => {
  it("redacts anything that looks like a credential", () => {
    expect(redactValue("hunter2", "password")).toBe("[redacted]");
    expect(redactValue("sk_live_x", "apiKey")).toBe("[redacted]");
    expect(redactValue("abc", "authorization")).toBe("[redacted]");
    expect(redactValue("abc", "STRIPE_KEY")).toBe("[redacted]");
    // A JWT under an innocent key is still a credential.
    expect(redactValue("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEyMw.sig", "note")).toBe("[redacted]");
    // Ordinary values survive.
    expect(redactValue("index.html", "path")).toBe("index.html");
    expect(redactValue(42, "size")).toBe(42);
    expect(redactValue(true, "active")).toBe(true);
  });

  it("redacts nested structures and truncates long values", () => {
    const redacted = redactFields({
      user: { name: "ada", password: "hunter2" },
      headers: { authorization: "Bearer x", "x-api-key": "sk_1" },
      body: "x".repeat(1000),
      list: [{ secret: "s3cr3t" }, { id: 1 }],
    }) as unknown as Record<string, unknown>;
    expect((redacted.user as Record<string, unknown>).password).toBe("[redacted]");
    expect((redacted.user as Record<string, unknown>).name).toBe("ada");
    expect((redacted.headers as Record<string, unknown>).authorization).toBe("[redacted]");
    expect((redacted.headers as Record<string, unknown>)["x-api-key"]).toBe("[redacted]");
    // Long values are cut down to a fixed budget with a marker.
    expect(redacted.body as string).toMatch(/\[truncated\]$/);
    expect((redacted.body as string).length).toBeLessThan(600);
    const list = redacted.list as Array<Record<string, unknown>>;
    expect(list[0]!.secret).toBe("[redacted]");
    expect(list[1]!.id).toBe(1);
  });

  it("emits newline-delimited JSON with level, scope and time", async () => {
    resetLoggerCache();
    const written: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      written.push(String(line));
    });
    try {
      setConfig("logging.level", "debug");
      const log = createLogger("test-scope");
      log.info("hello", { path: "/index.html", password: "hunter2" });
      log.child("child").warn("careful", { count: 2 });
      // Give the async settings lookup a tick to settle.
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      spy.mockRestore();
    }
    expect(written.length).toBeGreaterThanOrEqual(2);
    const first = JSON.parse(written[0]!) as Record<string, unknown>;
    expect(first.level).toBe("info");
    expect(first.scope).toBe("test-scope");
    expect(first.message).toBe("hello");
    expect(first.password).toBe("[redacted]");
    expect(typeof first.time).toBe("string");
    const second = JSON.parse(written[1]!) as Record<string, unknown>;
    expect(second.scope).toBe("test-scope.child");
    expect(second.level).toBe("warn");
    await setConfig("logging.level", "info");
  });
});

// ---------------------------------------------------------------- §8.1 caching

describe("asset cache and conditional requests (§8.1)", () => {
  beforeEach(() => {
    clearAssetCache();
    configureAssetCache({ ttlMs: 60_000, maxBytes: 1024 * 1024 });
  });

  it("caches bytes, returns a stable ETag and evicts the least recently used entry", () => {
    const small = Buffer.from("body{}");
    const etag = etagFor(small);
    expect(etag).toBe(etagFor(Buffer.from("body{}")));
    expect(etag).not.toBe(etagFor(Buffer.from("body{ }")));

    setCachedAsset(1, "a.css", { content: small, etag, updatedAt: "", sizeBytes: small.byteLength, contentType: "text/css" });
    expect(getCachedAsset(1, "a.css")?.content.toString()).toBe("body{}");
    expect(assetCacheStats().entries).toBe(1);
    expect(assetCacheStats().hits).toBe(1);
    expect(getCachedAsset(1, "missing.css")).toBeNull();

    invalidateAsset(1, "a.css");
    expect(getCachedAsset(1, "a.css")).toBeNull();
    expect(assetCacheStats().entries).toBe(0);
  });

  it("expires entries once the TTL passes", () => {
    configureAssetCache({ ttlMs: 1, maxBytes: 1024 * 1024 });
    const content = Buffer.from("x");
    setCachedAsset(2, "b.css", { content, etag: etagFor(content), updatedAt: "", sizeBytes: 1, contentType: "text/css" });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getCachedAsset(2, "b.css")).toBeNull();
        configureAssetCache({ ttlMs: 60_000 });
        resolve();
      }, 10);
    });
  });

  it("serves a matching If-None-Match as 304 and never caches HTML", async () => {
    clearAssetCache();
    const target = { user: owner.username, project: project.name, path: "/manifest.json" };
    const first = await serveProjectRequest(get(`/${owner.username}/${project.name}/manifest.json`), target);
    expect(first.status).toBe(200);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    expect(first.headers.get("cache-control")).toContain("max-age=86400");

    const second = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/manifest.json`, { "if-none-match": etag! }),
      target,
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");

    // HTML is per-request state: no ETag, no cache entry, always no-store.
    const html = await serveProjectRequest(
      get(`/${owner.username}/${project.name}/`),
      { user: owner.username, project: project.name, path: "/" },
    );
    expect(html.status).toBe(200);
    expect(html.headers.get("etag")).toBeNull();
    expect(html.headers.get("cache-control")).toBe("no-store");
    expect(getCachedAsset(project.id, "index.html")).toBeNull();
  });
});

// ---------------------------------------------------------------- §8.4 writes

describe("per-project write serialization (§8.4)", () => {
  it("runs one writer at a time per project and parallel across projects", async () => {
    let active = 0;
    let peak = 0;
    const task = async (projectId: number) =>
      withProjectWriteLock(projectId, async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      });

    await Promise.all([task(11), task(11), task(11)]);
    expect(peak).toBe(1);
    expect(isWriteLockIdle(11)).toBe(true);

    // Different projects are not serialized against each other.
    active = 0;
    peak = 0;
    await Promise.all([task(12), task(13)]);
    expect(peak).toBe(2);
  });

  it("releases the lock when the body throws", async () => {
    await expect(
      withProjectWriteLock(21, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(isWriteLockIdle(21)).toBe(true);
    // And the next writer still runs.
    await expect(withProjectWriteLock(21, async () => "ok")).resolves.toBe("ok");
  });

  it("serializes document writes through the store", async () => {
    const store = createDocumentStore(db);
    await store.insert(project.id, "concurrency", { id: "counter", hits: 0 });
    await Promise.all(
      Array.from({ length: 5 }, () =>
        store.update(project.id, "concurrency", { id: "counter" }, { $inc: { hits: 1 } }, false),
      ),
    );
    const row = await store.get(project.id, "concurrency", "counter");
    expect((row?.document as { hits?: number }).hits).toBe(5);
  });
});

// ---------------------------------------------------------------- schedules

describe("cron schedules (Tech docs §8)", () => {
  it("parses the documented field syntax and rejects nonsense", () => {
    expect(parseCronExpression("0,15,30,45 * * * *")).not.toBeNull();
    // A step field is valid too.
    expect(parseCronExpression("*/15 * * * *")).not.toBeNull();
    expect(parseCronExpression("0 3 * * 1")).not.toBeNull();
    expect(parseCronExpression("0 0 1 jan mon")).not.toBeNull();
    expect(parseCronExpression("0 0 * * 7")).not.toBeNull(); // Sunday as 7
    expect(parseCronExpression("0 0 * * mon-fri")).not.toBeNull();
    // Invalid
    expect(parseCronExpression("60 * * * *")).toBeNull();
    expect(parseCronExpression("* * * *")).toBeNull();
    expect(parseCronExpression("0 0 * * xyz")).toBeNull();
    expect(parseCronExpression("5-1 * * * *")).toBeNull();
    expect(parseCronExpression("*/0 * * * *")).toBeNull();
  });

  it("computes the next run in UTC", () => {
    const schedule = parseCronExpression("30 4 * * *")!;
    expect(describeSchedule(schedule)).toContain("UTC");
    const from = new Date("2026-03-10T04:31:00.000Z");
    const next = nextCronRun(schedule, from)!;
    expect(next.toISOString()).toBe("2026-03-11T04:30:00.000Z");

    // Every quarter hour.
    const quarter = parseCronExpression("0,15,30,45 * * * *")!;
    expect(nextCronRun(quarter, new Date("2026-03-10T04:31:00.000Z"))!.toISOString()).toBe(
      "2026-03-10T04:45:00.000Z",
    );

    // Mondays only.
    const mondays = parseCronExpression("0 3 * * 1")!;
    const afterWednesday = new Date("2026-03-11T00:00:00.000Z");
    expect(nextCronRun(mondays, afterWednesday)!.getUTCDay()).toBe(1);
  });

  it("flags a schedule that can never fire", () => {
    expect(scheduleIsReachable(parseCronExpression("0 0 30 2 *")!)).toBe(false);
    expect(scheduleIsReachable(parseCronExpression("0 0 * * *")!)).toBe(true);
  });

  it("reads schedule and every_minutes out of task parameters", () => {
    expect(scheduleFromParameters({ schedule: "0 4 * * *" }).schedule).not.toBeNull();
    expect(scheduleFromParameters({ every_minutes: 45 }).everyMinutes).toBe(45);
    expect(scheduleFromParameters({ every_minutes: 0 }).everyMinutes).toBeNull();
    expect(scheduleFromParameters("nope")).toEqual({ schedule: null, everyMinutes: null });
  });

  it("lets a task's schedule decide next_run_at, and the API validates it", async () => {
    const expression = parseCronExpression("0 5 * * *")!;
    const next = nextRunAtFor("clean_old_logs", "2026-05-05T06:00:00.000Z", 0, {
      schedule: expression.expression,
    });
    expect(next).toBe("2026-05-06T05:00:00.000Z");

    // every_minutes overrides the built-in cadence.
    expect(nextRunAtFor("heartbeat", "2026-05-05T06:00:00.000Z", 0, { every_minutes: 30 })).toBe(
      "2026-05-05T06:30:00.000Z",
    );
    // The operator's floor still applies to interval schedules.
    expect(nextRunAtFor("heartbeat", "2026-05-05T06:00:00.000Z", 60, { every_minutes: 30 })).toBe(
      "2026-05-05T07:00:00.000Z",
    );

    sessionCookie = ownerSession;
    const saved = await cronToggle(
      put(
        `/api/cron?projectId=${project.id}`,
        { task: "clean_old_logs", isEnabled: true, parameters: { schedule: "0 5 * * *" } },
      ),
      NO_CONTEXT,
    );
    expect(saved.status).toBe(200);
    const listed = await cronList(get(`/api/cron?projectId=${project.id}`), NO_CONTEXT);
    const body = (await listed.json()) as { data: Array<{ task: string; parameters: { schedule?: string } }> };
    expect(body.data.find((row) => row.task === "clean_old_logs")!.parameters.schedule).toBe("0 5 * * *");

    const invalid = await cronToggle(
      put(`/api/cron?projectId=${project.id}`, {
        task: "clean_old_logs",
        isEnabled: true,
        parameters: { schedule: "not a schedule" },
      }),
      NO_CONTEXT,
    );
    expect(invalid.status).toBe(400);

    const impossible = await cronToggle(
      put(`/api/cron?projectId=${project.id}`, {
        task: "clean_old_logs",
        isEnabled: true,
        parameters: { schedule: "0 0 30 2 *" },
      }),
      NO_CONTEXT,
    );
    expect(impossible.status).toBe(400);

    // Running the task recomputes next_run_at from the stored schedule.
    await runCronTask(project.id, "clean_old_logs");
    const rows = await db.raw<{ next_run_at: string }>(
      `SELECT next_run_at FROM cron_configs WHERE project_id = ${placeholder(db.driver, 0)} AND task_name = 'clean_old_logs'`,
      [project.id],
    );
    expect(new Date(rows[0]!.next_run_at).getTime()).toBeGreaterThan(Date.now());
  });
});

function put(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test${url}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------- §8.3 upload

describe("upload handling (§8.3)", () => {
  it("minifies on save by default and honours ?minify=0", async () => {
    const key = await createApiKey(owner.id, project.id, "ops-upload");
    const headers = { authorization: `Bearer ${key.key}` };
    const padded = "body {\n  color: red; /* note */\n}\n";

    const defaulted = await storageUpload(
      postRaw(`/api/storage/upload?projectId=${project.id}&path=auto.css`, padded, headers),
      NO_CONTEXT,
    );
    expect(defaulted.status).toBe(201);
    const autoRow = await db.raw<{ content_text: string }>(
      `SELECT content_text FROM files WHERE project_id = ${placeholder(db.driver, 0)} AND path = ?`,
      [project.id, "auto.css"],
    );
    expect(autoRow[0]!.content_text).toBe("body{color:red}");

    const opted = await storageUpload(
      postRaw(`/api/storage/upload?projectId=${project.id}&path=raw.css&minify=0`, padded, headers),
      NO_CONTEXT,
    );
    expect(opted.status).toBe(201);
    const rawRow = await db.raw<{ content_text: string }>(
      `SELECT content_text FROM files WHERE project_id = ${placeholder(db.driver, 0)} AND path = ?`,
      [project.id, "raw.css"],
    );
    expect(rawRow[0]!.content_text).toBe(padded);

    // A config flip turns the default off for everyone.
    await setConfig("storage.minify_on_save", false);
    const unminified = await storageUpload(
      postRaw(`/api/storage/upload?projectId=${project.id}&path=config-off.css`, padded, headers),
      NO_CONTEXT,
    );
    expect(unminified.status).toBe(201);
    const offRow = await db.raw<{ content_text: string }>(
      `SELECT content_text FROM files WHERE project_id = ${placeholder(db.driver, 0)} AND path = ?`,
      [project.id, "config-off.css"],
    );
    expect(offRow[0]!.content_text).toBe(padded);
    await setConfig("storage.minify_on_save", true);
  });

  it("refuses an oversized body from its Content-Length before buffering", async () => {
    const key = await createApiKey(owner.id, project.id, "ops-big");
    const request = new Request(
      `https://app.test/api/storage/upload?projectId=${project.id}&path=huge.bin`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${key.key}`,
          // 50 MB declared: the cap is 10 MB by default.
          "content-length": String(50 * 1024 * 1024),
        },
        body: "small",
      },
    );
    const response = await storageUpload(request, NO_CONTEXT);
    expect(response.status).toBe(413);
  });
});

// ---------------------------------------------------------------- §5.6 SSL

describe("custom-domain certificates (§5.6)", () => {
  const fakeIssuer = (): AcmeIssuer => ({
    async issue(request) {
      await putAcmeChallenge(request.domain, "tok-1", "tok-1.thumbprint");
      return {
        certificatePem: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n",
        privateKeyPem: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
        expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      };
    },
  });

  beforeAll(async () => {
    await db.run(
      `INSERT INTO domains (project_id, domain, verification_token, is_verified)
       VALUES (${placeholder(db.driver, 0)}, 'app.example.com', 'tok', 1)`,
      [project.id],
    );
    await db.run(
      `INSERT INTO domains (project_id, domain, verification_token, is_verified)
       VALUES (${placeholder(db.driver, 0)}, 'unverified.example.com', 'tok2', 0)`,
      [project.id],
    );
  });

  it("serves and expires HTTP-01 challenges", async () => {
    await putAcmeChallenge("app.example.com", "abc123", "abc123.thumbprint");
    expect(await getAcmeChallenge("abc123", "app.example.com")).toBe("abc123.thumbprint");
    // Scoped to the domain being validated.
    expect(await getAcmeChallenge("abc123", "other.example.com")).toBeNull();
    expect(await getAcmeChallenge("unknown")).toBeNull();

    await db.run(
      `UPDATE acme_challenges SET expires_at = ${placeholder(db.driver, 0)} WHERE token = 'abc123'`,
      [new Date(Date.now() - 1000).toISOString()],
    );
    expect(await getAcmeChallenge("abc123")).toBeNull();
    await purgeExpiredChallenges();
  });

  it("refuses to issue unless ssl.auto_provision is on", async () => {
    await expect(
      provisionCertificate("app.example.com", { email: "ops@example.com", issuer: fakeIssuer() }),
    ).rejects.toThrow(/ssl.auto_provision/);
  });

  it("provisions, stores and renews a certificate once enabled", async () => {
    await setConfig("ssl.auto_provision", true);
    const certificate = await provisionCertificate("app.example.com", {
      email: "ops@example.com",
      issuer: fakeIssuer(),
    });
    expect(certificate.expiresAt).toBeTruthy();
    const stored = await getCertificate("app.example.com");
    expect(stored!.certificatePem).toContain("BEGIN CERTIFICATE");

    const status = await sslStatus();
    expect(status.enabled).toBe(true);
    expect(status.certificates).toBe(1);

    // A certificate inside the 30-day window is due for renewal.
    await db.run(
      `UPDATE domains SET ssl_expires_at = ${placeholder(db.driver, 0)} WHERE domain = 'app.example.com'`,
      [new Date(Date.now() + 5 * 86_400_000).toISOString()],
    );
    expect(await domainsNeedingRenewal()).toContain("app.example.com");

    const renewed = await renewExpiringCertificates({
      email: "ops@example.com",
      issuer: fakeIssuer(),
    });
    expect(renewed.renewed).toContain("app.example.com");

    // An unverified domain cannot be issued for.
    await expect(
      provisionCertificate("unverified.example.com", { email: "ops@example.com", issuer: fakeIssuer() }),
    ).rejects.toThrow(/Verify the domain/);

    // And with the switch off again, renewal is a no-op.
    await setConfig("ssl.auto_provision", false);
    const skipped = await renewExpiringCertificates({ issuer: fakeIssuer() });
    expect(skipped.skipped).toBe(true);
  });
});

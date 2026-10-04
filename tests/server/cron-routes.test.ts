/**
 * Unit and integration tests for cron modules:
 * - lib/server/cron/common.ts
 * - lib/server/cron/tasks.ts
 * - lib/server/cron/runner.ts
 * - lib/server/cron/handlers.ts
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "cron-test-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "cron-test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "cron-test-encryption-key-32-byte!";
process.env.PLATFORM_CRON_TOKEN = "test-platform-cron-token";

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
import { createProject, createUser, putFile } from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import {
  BUILTIN_TASKS,
  CRON_TASKS,
  cronList,
  cronRun,
  cronToggle,
  platformCronSweep,
  runCronTask,
} from "@/lib/server/cron-routes";

let db: ReturnType<typeof getDb>;
let user: { id: number; username: string };
let project: { id: number; name: string };
let userCookie: string;

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  user = await createUser("cronuser", "Password123!");
  project = await createProject(user.id, "cronproj");
  userCookie = await createSession(user.id);
  sessionCookie = userCookie;

  // Insert a visit log and a temporary file for cleanup tests
  await db.run(
    `INSERT INTO visit_logs (project_id, visited_at, ip, user_agent, route, is_unique)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [project.id, new Date(Date.now() - 86400000).toISOString(), "127.0.0.1", "agent", "/", 1],
  );
  await putFile(user.id, project.id, "temp/old_upload.tmp", Buffer.from("temp data"), false);
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

function put(url: string, body: unknown): Request {
  return new Request(`https://app.test${url}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function post(url: string, body: unknown, headers?: Record<string, string>): Request {
  return new Request(`https://app.test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
}

describe("Cron task listing (cronList)", () => {
  it("lists all available and built-in tasks with defaults", async () => {
    sessionCookie = userCookie;
    const res = await cronList(get(`/api/cron?projectId=${project.id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toEqual([...CRON_TASKS]);
    expect(body.builtin).toEqual([...BUILTIN_TASKS]);
    expect(body.data.length).toBe(CRON_TASKS.length);
    expect(body.data.every((t: any) => t.isEnabled)).toBe(true);
  });
});

describe("Cron task configuration (cronToggle)", () => {
  it("toggles task and updates parameters with validation", async () => {
    sessionCookie = userCookie;

    // Valid schedule update
    const res = await cronToggle(
      put(`/api/cron?projectId=${project.id}`, {
        task: "clean_old_logs",
        isEnabled: false,
        parameters: { schedule: "0 2 * * *" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isEnabled).toBe(false);
    expect(body.parameters.schedule).toBe("0 2 * * *");

    // Invalid cron expression
    const badSched = await cronToggle(
      put(`/api/cron?projectId=${project.id}`, {
        task: "clean_old_logs",
        isEnabled: true,
        parameters: { schedule: "invalid-cron" },
      }),
    );
    expect(badSched.status).toBe(400);

    // Negative every_minutes
    const badMinutes = await cronToggle(
      put(`/api/cron?projectId=${project.id}`, {
        task: "clean_old_logs",
        isEnabled: true,
        parameters: { every_minutes: -10 },
      }),
    );
    expect(badMinutes.status).toBe(400);

    // Re-enable
    await cronToggle(
      put(`/api/cron?projectId=${project.id}`, { task: "clean_old_logs", isEnabled: true }),
    );
  });
});

describe("Cron task execution (cronRun & runCronTask)", () => {
  it("executes built-in tasks directly", async () => {
    // 1. Heartbeat
    const hb = await runCronTask(project.id, "heartbeat");
    expect(hb.alive).toBe(true);

    // 2. Daily stats rollup
    const stats = await runCronTask(project.id, "generate_daily_stats");
    expect(stats.totalVisits).toBeDefined();

    // 3. Clean old logs
    const logs = await runCronTask(project.id, "clean_old_logs");
    expect(logs.deletedVisits).toBeDefined();

    // 4. Clean expired sessions
    const sess = await runCronTask(project.id, "clean_expired_sessions");
    expect(sess.purgedSessions).toBeDefined();

    // 5. Storage audit
    const audit = await runCronTask(project.id, "storage_audit");
    expect(audit.files).toBeDefined();

    // 6. Renew SSL certificates
    const ssl = await runCronTask(project.id, "renew_ssl_certificates");
    expect(ssl).toBeDefined();

    // 7. Retry failed webhooks
    const wh = await runCronTask(project.id, "retry_failed_webhooks");
    expect(wh.pending).toBeDefined();

    // 8. Send daily summary webhook
    const summary = await runCronTask(project.id, "send_daily_summary_webhook");
    expect(summary.delivered).toBe(true);

    // 9. Clean orphaned uploads
    const cleanUp = await runCronTask(project.id, "clean_orphaned_uploads");
    expect(cleanUp.deletedFiles).toBeDefined();
  });

  it("handles HTTP cronRun on-demand execution and errors", async () => {
    sessionCookie = userCookie;
    const res = await cronRun(post(`/api/cron/run?projectId=${project.id}`, { task: "heartbeat" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.alive).toBe(true);

    // Missing task in request body
    const missingTask = await cronRun(post(`/api/cron/run?projectId=${project.id}`, {}));
    expect(missingTask.status).toBe(400);
  });

  it("handles platform runner sweep using PLATFORM_CRON_TOKEN", async () => {
    sessionCookie = ""; // anonymous caller with platform token

    // Platform token via x-cron-token header
    const sweepRes = await cronRun(
      post("/api/cron/run", { due: true }, { "x-cron-token": "test-platform-cron-token" }),
    );
    expect(sweepRes.status).toBe(200);
    const sweepJson = await sweepRes.json();
    expect(sweepJson.sweep).toBeDefined();

    // Direct platformCronSweep call
    const directSweep = await platformCronSweep();
    expect(directSweep.ran).toBeDefined();
    expect(directSweep.skipped).toBeDefined();
  });
});

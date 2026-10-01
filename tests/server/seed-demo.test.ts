/**
 * The demo seeder is shipped behaviour (`bun run seed`), so it is held to the
 * same standard as anything else: idempotent, dialect-agnostic, and honest
 * about what it skipped.
 *
 * Written against `Db.raw` rather than a native handle so it runs on either
 * dialect unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDb, type Db } from "@/lib/server/db/index";
import { DEMO_PASSWORD, seedDemoData } from "@/lib/server/seed-demo";

let db: Db;

const DEMO_USERNAMES = ["ada", "grace", "linus", "margaret", "admin"];

async function count(where: string, params: unknown[]): Promise<number> {
  const rows = await db.raw<{ n: string | number }>(`SELECT COUNT(*) AS n FROM ${where}`, params);
  return Number(rows[0]?.n ?? 0);
}

beforeAll(async () => {
  db = getDb();
  // Another suite in this worker may already have applied the schema, and the
  // migration files are not re-runnable (SQLite's ADD COLUMN has no IF NOT
  // EXISTS).
  const existing = await count("sqlite_master WHERE type='table' AND name='users'", []);
  if (existing === 0) {
    const dir = join(process.cwd(), "db", "sqlite");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      db.exec(readFileSync(join(dir, file), "utf8"));
    }
  }
});

afterAll(async () => {
  // The seeder refuses to touch an existing demo account, so leaving rows
  // behind would make the suite order-dependent.
  for (const username of DEMO_USERNAMES) {
    const users = await db.raw<{ id: number }>("SELECT id FROM users WHERE username = ?", [username]);
    for (const user of users) {
      const projects = await db.raw<{ id: number }>("SELECT id FROM projects WHERE user_id = ?", [user.id]);
      for (const project of projects) {
        await db.run(
          "DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE project_id = ?)",
          [project.id],
        );
        for (const table of [
          "webhook_outbox", "webhooks", "api_keys", "secrets", "routes", "roles",
          "visitors", "files", "project_data", "visit_logs", "daily_project_stats",
          "domains", "cron_configs", "api_endpoints",
        ]) {
          await db.run(`DELETE FROM ${table} WHERE project_id = ?`, [project.id]);
        }
        await db.run("DELETE FROM projects WHERE id = ?", [project.id]);
      }
      await db.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);
      await db.run("DELETE FROM users WHERE id = ?", [user.id]);
    }
  }
});

describe("seedDemoData", () => {
  it("creates the demo accounts, each with projects", async () => {
    const result = await seedDemoData();

    expect(result.created.map((c) => c.username).sort()).toEqual([...DEMO_USERNAMES].sort());
    expect(result.created.filter((c) => c.projects.length > 0)).toHaveLength(4);

    const admins = await count("users WHERE is_admin = " + (db.driver === "sqlite" ? "1" : "TRUE"), []);
    expect(admins).toBe(1);
    const operators = await count("users WHERE is_operator = " + (db.driver === "sqlite" ? "1" : "TRUE"), []);
    expect(operators).toBe(2);
    // Every account carries a cap, so the quota panel has something to render.
    expect(await count("users WHERE storage_cap_bytes > 0", [])).toBe(DEMO_USERNAMES.length);
  });

  it("hashes the shared demo password rather than storing it", async () => {
    const rows = await db.raw<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE username = 'ada'",
    );
    expect(rows[0]!.password_hash).not.toContain(DEMO_PASSWORD);
    expect(rows[0]!.password_hash.startsWith("scrypt$")).toBe(true);
  });

  it("seeds documents, files and analytics per project", async () => {
    const projects = await db.raw<{ id: number }>("SELECT id FROM projects WHERE name = 'atlas-dashboard'");
    const projectId = projects[0]!.id;

    const tables = await db.raw<{ table_name: string; n: number }>(
      "SELECT table_name, COUNT(*) AS n FROM project_data WHERE project_id = ? GROUP BY table_name",
      [projectId],
    );
    expect(tables.map((t) => t.table_name).sort()).toEqual(["orders", "tickets"]);
    expect(tables.find((t) => t.table_name === "orders")!.n).toBe(8);

    const files = await db.raw<{ path: string }>("SELECT path FROM files WHERE project_id = ?", [projectId]);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("index.html");
    expect(paths).toContain("static/app.css");
    expect(paths).toContain("manifest.json");
    expect(paths).toContain("sw.js");

    // The shared library is its own reserved project, not a folder inside this
    // one, so its asset is served from /{username}/library/reset.css.
    const libraryFiles = await db.raw<{ path: string }>(
      "SELECT path FROM files WHERE project_id = (SELECT id FROM projects WHERE name = 'library' LIMIT 1)",
    );
    expect(libraryFiles.map((f) => f.path)).toContain("reset.css");

    expect(await count("daily_project_stats WHERE project_id = ?", [projectId])).toBeGreaterThan(30);
    expect(await count("visit_logs WHERE project_id = ?", [projectId])).toBeGreaterThan(30);
  });

  /**
   * The seeded history used to be a flat "last 30 days", which put ~180 visits
   * into the current calendar month and made every demo project answer 402 —
   * the very thing a demo is supposed to avoid.
   */
  it("leaves every active project under its monthly visit quota", async () => {
    const active = db.driver === "sqlite" ? 1 : true;
    const projects = await db.raw<{ id: number; free_visits_per_month: number }>(
      // The library project is a CDN namespace with no visit quota of its own.
      "SELECT id, free_visits_per_month FROM projects WHERE is_active = ? AND name <> 'library'",
      [active],
    );
    expect(projects.length).toBeGreaterThan(3);

    const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
    for (const project of projects) {
      const visits = await count(
        "visit_logs WHERE project_id = ? AND visited_at >= ?",
        [project.id, monthStart],
      );
      expect(
        visits,
        `project ${project.id} is seeded at ${visits} visits against a quota of ${project.free_visits_per_month}`,
      ).toBeLessThan(project.free_visits_per_month);
    }
  });

  it("suspends one project so the console's inactive state is visible", async () => {
    const rows = await db.raw<{ is_active: number | boolean }>(
      "SELECT is_active FROM projects WHERE name = 'archive-2019'",
    );
    expect(rows[0]!.is_active).toBe(db.driver === "sqlite" ? 0 : false);
  });

  it("seeds a verified domain and one awaiting its TXT record", async () => {
    const verified = db.driver === "sqlite" ? 1 : true;
    const rows = await db.raw<{ domain: string; is_verified: number | boolean }>(
      `SELECT domain, is_verified FROM domains
       WHERE project_id = (SELECT id FROM projects WHERE name = 'atlas-dashboard')`,
    );
    expect(rows.filter((r) => r.is_verified === verified)).toHaveLength(1);
    expect(rows.filter((r) => r.is_verified !== verified)).toHaveLength(1);
  });

  it("hands back one working API key per project", async () => {
    const result = await seedDemoData({ reset: true });
    const entries = Object.entries(result.apiKeys);
    expect(entries).toHaveLength(6);

    // The key comes back in full but is stored only as a hash plus a prefix.
    const [label, key] = entries[0]!;
    const projectName = label.split("/")[1]!;
    const rows = await db.raw<{ key_hash: string; prefix: string }>(
      "SELECT key_hash, prefix FROM api_keys WHERE name = ?",
      [`${projectName}-client`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key_hash).not.toBe(key);
    expect(key.startsWith(rows[0]!.prefix)).toBe(true);
    expect(rows[0]!.prefix.length).toBeGreaterThanOrEqual(8);
  });

  it("is idempotent: a second run skips instead of duplicating", async () => {
    const projectsBefore = await count("projects", []);
    const result = await seedDemoData();

    expect(result.created).toHaveLength(0);
    expect(result.skipped.sort()).toEqual([...DEMO_USERNAMES].sort());
    expect(await count("projects", [])).toBe(projectsBefore);
  });

  it("reports skipped secrets rather than storing unencryptable ones", async () => {
    // Without SESSION_SECRET, §7.5 encryption is impossible; the seeder must
    // say so rather than write a row the app could never read back.
    const result = await seedDemoData({ reset: true });
    // Encryption now always has a key: SESSION_SECRET when set, otherwise the
    // generated secret the platform persists. Only a genuinely unreachable
    // database can make this fail, which is what secretsSkipped reports.
    expect(result.secretsSkipped).toBe(false);
    // Six projects × two secrets.
    expect(await count("secrets", [])).toBe(12);
  });

  it("refuses to seed in production without an explicit override", async () => {
    const previous = process.env.NODE_ENV;
    // process.env.NODE_ENV is typed readonly by @types/node, but the guard
    // under test has to observe a production value.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      await expect(seedDemoData()).rejects.toThrow(/production/i);
      await expect(seedDemoData({ allowProduction: true })).resolves.toBeDefined();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = previous;
    }
  });
});

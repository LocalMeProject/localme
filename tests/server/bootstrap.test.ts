/**
 * First-boot behaviour: a fresh deployment must be reachable without opening the
 * database by hand, and must stop bootstrapping the moment anyone signs up.
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "bootstrap-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/server/db/index";
import { authenticateUser, createUser } from "@/lib/server/repos";
import { ensureBootstrapAdmin, defaultAdminAllowed } from "@/lib/server/bootstrap";

const db = getDb();

beforeAll(() => {
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function userCount(): Promise<number> {
  const rows = await db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM users`);
  return Number(rows[0]?.n ?? 0);
}

describe("first-boot admin bootstrap", () => {
  it("creates exactly one admin when the deployment has no users, then never again", async () => {
    expect(await userCount()).toBe(0);

    const first = await ensureBootstrapAdmin();
    expect(first.created).toBe(true);
    expect(first.username).toBe("admin");
    expect(first.usingDefaultPassword).toBe(true);

    const user = await authenticateUser("admin", "admin1234");
    expect(user).not.toBeNull();
    expect(user!.isAdmin).toBe(true);

    // Idempotent: a second call must not create a second admin or reset
    // anything, because every boot calls this.
    const second = await ensureBootstrapAdmin();
    expect(second.created).toBe(false);
    expect(await userCount()).toBe(1);
  });

  it("stops bootstrapping as soon as anyone exists", async () => {
    // The fixture above already created one, so a signup is what happens next.
    await createUser("someone-else", "password123");
    const before = await userCount();
    const result = await ensureBootstrapAdmin();
    expect(result.created).toBe(false);
    expect(await userCount()).toBe(before);
  });

  it("refuses the default password in production unless explicitly allowed", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousAllow = env.ALLOW_DEFAULT_ADMIN_PASSWORD;
    try {
      env.NODE_ENV = "production";
      delete env.ALLOW_DEFAULT_ADMIN_PASSWORD;
      expect(defaultAdminAllowed()).toBe(false);

      env.ALLOW_DEFAULT_ADMIN_PASSWORD = "1";
      expect(defaultAdminAllowed()).toBe(true);
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
      if (previousAllow === undefined) delete env.ALLOW_DEFAULT_ADMIN_PASSWORD;
      else env.ALLOW_DEFAULT_ADMIN_PASSWORD = previousAllow;
    }
  });
});

describe("signing secret resolution", () => {
  it("prefers SESSION_SECRET from the environment", async () => {
    const { resolveSessionSecret, sessionSecretConfigured } = await import("@/lib/server/session-secret");
    expect(sessionSecretConfigured()).toBe(true);
    expect(await resolveSessionSecret()).toBe("test-session-secret");
  });

  it("falls back to a generated secret persisted in the database", async () => {
    const previous = process.env.SESSION_SECRET;
    const { resetSessionSecretCache, resolveSessionSecret } = await import("@/lib/server/session-secret");
    try {
      delete process.env.SESSION_SECRET;
      resetSessionSecretCache();
      const first = await resolveSessionSecret();
      expect(first.length).toBeGreaterThanOrEqual(32);

      // A second resolution returns the same value, and a second process would
      // read the same row — otherwise sessions would not survive a restart.
      resetSessionSecretCache();
      expect(await resolveSessionSecret()).toBe(first);

      const rows = await db.raw<{ config_value: unknown }>(
        `SELECT config_value FROM system_configs WHERE config_key = 'platform.session_secret'`,
      );
      expect(rows).toHaveLength(1);
    } finally {
      process.env.SESSION_SECRET = previous;
      resetSessionSecretCache();
    }
  });
});
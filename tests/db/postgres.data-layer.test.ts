/**
 * LocalMe data-layer tests on Postgres (CI-only; the SQLite twin covers local
 * dev). The DSL compiler shares one AST for both dialects; these tests verify
 * the Postgres JSONB rendering (->>, ::numeric, jsonb_set, jsonb concatenation)
 * against a real Postgres server, the migration runner end-to-end, and the full
 * dialect-neutral document-store contract from `document-store.contract.ts`.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { createDocumentStore } from "@/lib/server/db/documents";
import { getDb, type Db } from "@/lib/server/db/index";
import { resolveDriver } from "@/lib/server/db/driver";
import { documentStoreContract } from "./document-store.contract";

const hasPostgres = !!process.env.DATABASE_URL && process.env.DB_DRIVER === "postgres";

function makeDb(): Db {
  return getDb(resolveDriver());
}

/** Create (idempotently) the user and projects a suite needs. */
async function seed(
  userId: number,
  username: string,
  projects: Array<{ id: number; name: string }>,
): Promise<void> {
  const db = makeDb();
  await db.raw(
    `INSERT INTO users (id, username, password_hash) VALUES (${userId}, '${username}', 'x')
     ON CONFLICT (id) DO NOTHING`,
  );
  for (const project of projects) {
    await db.raw(
      `INSERT INTO projects (id, user_id, name) VALUES (${project.id}, ${userId}, '${project.name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  }
}

// Skipped automatically when DATABASE_URL is absent (local dev), and runs in
// the CI postgres-integration job after `bun run db:migrate`.
const suite = hasPostgres ? describe : describe.skip;

suite("document store (postgres)", () => {
  const store = createDocumentStore(makeDb());
  const projectId = 990001;

  beforeAll(async () => {
    await seed(990000, "pg-test", [{ id: projectId, name: "orders-project" }]);
    // Re-runnable against a persistent server: clear the fixture first.
    await store.delete(projectId, "orders", {});
    await store.insert(projectId, "orders", { id: "a", status: "paid", total: 140, tags: ["x"] });
    await store.insert(projectId, "orders", { id: "b", status: "shipped", total: 90, tags: ["y"] });
  });

  it("applies migrations and exposes the ledger", async () => {
    const rows = await makeDb().raw<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE dialect = 'postgres' ORDER BY name",
    );
    const expected = readdirSync(join(process.cwd(), "db", "postgres"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    // Parity guard: the ledger must list every file in the Postgres tree.
    expect(rows.map((row) => row.name)).toEqual(expected);
  });

  it("carries the platform-completion columns from migration 003", async () => {
    const rows = await makeDb().raw<{
      watermark_enabled: boolean;
      failed_login_count: number;
      locked_until: string | null;
    }>(
      `SELECT p.watermark_enabled, u.failed_login_count, u.locked_until
       FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ${projectId}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.watermark_enabled).toBe(true);
    expect(Number(rows[0]!.failed_login_count)).toBe(0);
    expect(rows[0]!.locked_until).toBeNull();
  });

  it("carries routes.required_permission from migration 004", async () => {
    const created = await makeDb().raw<{ id: number }>(
      `INSERT INTO routes (project_id, path_pattern, target_file, required_permission, is_active)
       VALUES (${projectId}, '/pg-permission-route', 'index.html', 'analytics_read', TRUE) RETURNING id`,
    );
    const rows = await makeDb().raw<{ required_permission: string | null }>(
      `SELECT required_permission FROM routes WHERE id = ${Number(created[0]!.id)}`,
    );
    expect(rows[0]!.required_permission).toBe("analytics_read");
    await makeDb().raw(`DELETE FROM routes WHERE id = ${Number(created[0]!.id)}`);
  });

  it("filters and sorts with JSONB semantics", async () => {
    const paid = await store.find(projectId, "orders", { filter: { status: "paid" } });
    expect(paid.data.map((d) => d.id)).toEqual(["a"]);
    const sorted = await store.find(projectId, "orders", { sort: { total: -1 } });
    expect(sorted.data.map((d) => d.id)).toEqual(["a", "b"]);
    const numeric = await store.find(projectId, "orders", { filter: { total: { $gt: 100 } } });
    expect(numeric.data.map((d) => d.id)).toEqual(["a"]);
  });

  it("updates with $inc and merge on JSONB", async () => {
    const n = await store.update(projectId, "orders", { id: "b" }, { $inc: { total: 15 } }, false);
    expect(n).toBe(1);
    const after = await store.get(projectId, "orders", "b");
    expect((after?.document as { total?: number } | null)?.total).toBe(105);
  });
});

if (hasPostgres) {
  // File-level beforeAll runs before every suite hook, so the contract's own
  // seeding finds its projects. Dedicated ids keep the JSONB suite's rows intact.
  beforeAll(async () => {
    await seed(990000, "pg-test", [
      { id: 990010, name: "contract-primary" },
      { id: 990011, name: "contract-secondary" },
    ]);
  });

  documentStoreContract({
    label: "postgres",
    makeDb,
    primaryProjectId: 990010,
    secondaryProjectId: 990011,
  });
}

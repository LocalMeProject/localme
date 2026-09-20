/**
 * LocalMe data-layer tests on Postgres (CI-only; the SQLite twin covers local
 * dev). The DSL compiler shares one AST for both dialects; these tests verify
 * the Postgres JSONB rendering (->>, ::numeric, jsonb_set, jsonb concatenation)
 * against a real Postgres server, and the migration runner end-to-end.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { createDocumentStore } from "@/lib/server/db/documents";
import { getDb, type Db } from "@/lib/server/db/index";
import { resolveDriver } from "@/lib/server/db/driver";

const hasPostgres = !!process.env.DATABASE_URL && process.env.DB_DRIVER === "postgres";

function makeDb(): Db {
  return getDb(resolveDriver());
}

// Skipped automatically when DATABASE_URL is absent (local dev), and runs in
// the CI postgres-integration job after `bun run db:migrate`.
const suite = hasPostgres ? describe : describe.skip;

suite("document store (postgres)", () => {
  const store = createDocumentStore(makeDb());
  const projectId = 990001;

  beforeAll(async () => {
    await makeDb().raw(
      "INSERT INTO users (id, username, password_hash) VALUES (990000, 'pg-test', 'x') ON CONFLICT (id) DO NOTHING",
    );
    await makeDb().raw(
      "INSERT INTO projects (id, user_id, name) VALUES (990001, 990000, 'orders-project') ON CONFLICT (id) DO NOTHING",
    );
    await store.insert(projectId, "orders", { id: "a", status: "paid", total: 140, tags: ["x"] });
    await store.insert(projectId, "orders", { id: "b", status: "shipped", total: 90, tags: ["y"] });
  });

  it("applies migrations and exposes the ledger", async () => {
    const rows = await makeDb().raw<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE dialect = 'postgres' ORDER BY name",
    );
    expect(rows.map((r) => r.name)).toContain("001_init.sql");
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

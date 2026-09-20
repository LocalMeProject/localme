/**
 * Data-layer tests on a real SQLite engine (in-memory) via the same facade the
 * app uses. All LocalMe business rules that depend on SQL semantics are
 * exercised here in CI — never as a sandbox gate.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

import { createDocumentStore } from "@/lib/server/db/documents";
import { getDb, type Db } from "@/lib/server/db/index";
import { resolveDriver } from "@/lib/server/db/driver";

function makeDb(): Db {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, file), "utf8"));
  }
  database
    .prepare("INSERT INTO users (username, password_hash) VALUES ('u1', 'x')")
    .run();
  database
    .prepare("INSERT INTO projects (id, user_id, name) VALUES (1, 1, 'p1')")
    .run();
  database
    .prepare("INSERT INTO projects (id, user_id, name) VALUES (2, 1, 'p2')")
    .run();
  return getDb({ driver: "sqlite", sqliteDatabase: database });
}

describe("driver selection", () => {
  it("defaults to in-memory sqlite", () => {
    const endpoint = resolveDriver({});
    expect(endpoint.driver).toBe("sqlite");
    expect(endpoint.sqlitePath).toBeUndefined();
  });

  it("requires file:/ prefix when DB_PATH is set", () => {
    expect(() => resolveDriver({ DB_PATH: "relative.db" })).toThrow(/file:\//);
    expect(resolveDriver({ DB_PATH: "file:/tmp/localme.db" }).sqlitePath).toBe("/tmp/localme.db");
  });

  it("postgres requires DATABASE_URL", () => {
    expect(() => resolveDriver({ DB_DRIVER: "postgres" })).toThrow(/DATABASE_URL/);
  });
});

describe("document store (sqlite)", () => {
  const store = createDocumentStore(makeDb());

  beforeAll(async () => {
    await store.insert(1, "orders", { id: "a", status: "paid", total: 140, tags: ["x"] });
    await store.insert(1, "orders", { id: "b", status: "shipped", total: 90, tags: ["y"] });
    await store.insert(2, "orders", { id: "c", status: "paid", total: 60 });
  });

  it("enforces project isolation", async () => {
    const result = await store.find(1, "orders", {});
    expect(result.data).toHaveLength(2);
    const other = await store.find(2, "orders", {});
    expect(other.data.map((d) => d.id)).toEqual(["c"]);
  });

  it("filters, sorts and paginates", async () => {
    const paid = await store.find(1, "orders", { filter: { status: "paid" } });
    expect(paid.data.map((d) => d.id)).toEqual(["a"]);
    const sorted = await store.find(1, "orders", { sort: { total: -1 } });
    expect(sorted.data.map((d) => d.id)).toEqual(["a", "b"]);
    const page = await store.find(1, "orders", { limit: 1, offset: 1, sort: { total: 1 } });
    // ASC over totals 90 (b) and 140 (a): ["b", "a"]; offset 1 → ["a"].
    expect(page.data.map((d) => d.id)).toEqual(["a"]);
  });

  it("supports operators", async () => {
    const gt = await store.find(1, "orders", { filter: { total: { $gt: 100 } } });
    expect(gt.data.map((d) => d.id)).toEqual(["a"]);
    const inOp = await store.find(1, "orders", { filter: { status: { $in: ["paid", "shipped"] } } });
    expect(inOp.data).toHaveLength(2);
    const or = await store.find(1, "orders", {
      filter: { $or: [{ status: "paid" }, { total: { $lt: 100 } }] },
    });
    expect(or.data).toHaveLength(2);
    const not = await store.find(1, "orders", { filter: { $not: { status: "paid" } } });
    expect(not.data.map((d) => d.id)).toEqual(["b"]);
    const missing = await store.find(1, "orders", { filter: { nope: { $exists: false } } });
    expect(missing.data).toHaveLength(2);
  });

  it("rejects duplicate ids and missing ids", async () => {
    await expect(store.insert(1, "orders", { id: "a" })).rejects.toThrow(/already exists/);
    await expect(store.insert(1, "orders", { status: "x" })).rejects.toThrow(/non-null id/);
  });

  it("updates with merge, $set, $inc and single-row cap", async () => {
    const n1 = await store.update(1, "orders", { id: "a" }, { status: "refunded" }, false);
    expect(n1).toBe(1);
    const after1 = await store.get(1, "orders", "a");
    expect((after1?.document as { status?: string } | null)?.status).toBe("refunded");

    const n2 = await store.update(1, "orders", { id: "a" }, { $inc: { total: 10 } }, false);
    expect(n2).toBe(1);
    const after2 = await store.get(1, "orders", "a");
    expect((after2?.document as { total?: number } | null)?.total).toBe(150);

    const n3 = await store.update(1, "orders", {}, { $set: { touched: true } }, false);
    expect(n3).toBe(1); // many=false caps to one row
    expect(n3).toBeLessThanOrEqual(1);
  });

  it("deletes by filter", async () => {
    const n = await store.delete(1, "orders", { status: "refunded" });
    expect(n).toBe(1);
    const left = await store.find(1, "orders", {});
    expect(left.data.map((d) => d.id)).toEqual(["b"]);
  });

  it("lists tables with counts", async () => {
    const tables = await store.listTables(1);
    expect(tables).toEqual([{ name: "orders", count: 1 }]);
  });

  it("rejects unsafe table names", async () => {
    await expect(store.find(1, "orders; DROP TABLE users", {})).rejects.toThrow(/Invalid identifier/);
  });
});

/**
 * Dialect-neutral document-store contract (Blueprint §4.2).
 *
 * The same assertions run against SQLite (`data-layer.test.ts`) and against a
 * real Postgres server (`postgres.data-layer.test.ts`), so the two dialect trees
 * cannot drift: every filter operator, the update modifiers, pagination and
 * project isolation are proven on both engines by one shared suite.
 *
 * Each caller supplies a database that already contains two projects, because
 * the two dialects get their schema from different sources (SQLite applies
 * `db/sqlite/*.sql` to an in-memory file; Postgres runs `scripts/migrate.mjs`).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createDocumentStore } from "@/lib/server/db/documents";
import type { Db } from "@/lib/server/db/index";

export interface DocumentStoreContract {
  /** Suite name, e.g. "sqlite" or "postgres". */
  label: string;
  /** A database already migrated and seeded with both project ids. */
  makeDb: () => Db;
  /** Project the majority of the fixture documents belong to. */
  primaryProjectId: number;
  /** Project used for the isolation check. */
  secondaryProjectId: number;
}

export function documentStoreContract(options: DocumentStoreContract): void {
  const { label, primaryProjectId: primary, secondaryProjectId: secondary } = options;
  const store = createDocumentStore(options.makeDb());

  describe(`document store (${label})`, () => {
    beforeAll(async () => {
      // Re-runnable against a persistent server: clear the fixture first.
      await store.delete(primary, "orders", {});
      await store.delete(secondary, "orders", {});
      await store.insert(primary, "orders", { id: "a", status: "paid", total: 140, tags: ["x"] });
      await store.insert(primary, "orders", { id: "b", status: "shipped", total: 90, tags: ["y"] });
      await store.insert(secondary, "orders", { id: "c", status: "paid", total: 60 });
    });

    it("enforces project isolation", async () => {
      const result = await store.find(primary, "orders", {});
      expect(result.data).toHaveLength(2);
      const other = await store.find(secondary, "orders", {});
      expect(other.data.map((d) => d.id)).toEqual(["c"]);
    });

    it("filters, sorts and paginates", async () => {
      const paid = await store.find(primary, "orders", { filter: { status: "paid" } });
      expect(paid.data.map((d) => d.id)).toEqual(["a"]);
      const sorted = await store.find(primary, "orders", { sort: { total: -1 } });
      expect(sorted.data.map((d) => d.id)).toEqual(["a", "b"]);
      const page = await store.find(primary, "orders", { limit: 1, offset: 1, sort: { total: 1 } });
      // ASC over totals 90 (b) and 140 (a): ["b", "a"]; offset 1 → ["a"].
      expect(page.data.map((d) => d.id)).toEqual(["a"]);
    });

    it("supports operators", async () => {
      const gt = await store.find(primary, "orders", { filter: { total: { $gt: 100 } } });
      expect(gt.data.map((d) => d.id)).toEqual(["a"]);
      const inOp = await store.find(primary, "orders", { filter: { status: { $in: ["paid", "shipped"] } } });
      expect(inOp.data).toHaveLength(2);
      const or = await store.find(primary, "orders", {
        filter: { $or: [{ status: "paid" }, { total: { $lt: 100 } }] },
      });
      expect(or.data).toHaveLength(2);
      const nor = await store.find(primary, "orders", {
        filter: { $nor: [{ status: "paid" }, { total: { $lt: 100 } }] },
      });
      expect(nor.data).toHaveLength(0);
      const not = await store.find(primary, "orders", { filter: { $not: { status: "paid" } } });
      expect(not.data.map((d) => d.id)).toEqual(["b"]);
      const missing = await store.find(primary, "orders", { filter: { nope: { $exists: false } } });
      expect(missing.data).toHaveLength(2);
    });

    it("rejects duplicate ids and missing ids", async () => {
      await expect(store.insert(primary, "orders", { id: "a" })).rejects.toThrow(/already exists/);
      await expect(store.insert(primary, "orders", { status: "x" })).rejects.toThrow(/non-null id/);
    });

    // §4.2: "1 and \"1\" are the same id". That only holds if the engine
    // compares ids as text, which is exactly where SQLite (json_extract is
    // type-preserving) and Postgres (->> text-casts) used to drift apart.
    it("treats a numeric id and its string form as the same document", async () => {
      await store.delete(primary, "numeric_ids", {});
      await store.insert(primary, "numeric_ids", { id: 1, label: "one" });

      // Both spellings resolve to the same row.
      const byNumber = await store.get(primary, "numeric_ids", 1);
      const byString = await store.get(primary, "numeric_ids", "1");
      expect((byNumber?.document as { label?: string } | null)?.label).toBe("one");
      expect((byString?.document as { label?: string } | null)?.label).toBe("one");

      // The uniqueness guarantee covers both spellings.
      await expect(store.insert(primary, "numeric_ids", { id: "1" })).rejects.toThrow(/already exists/);
      await expect(store.insert(primary, "numeric_ids", { id: 1 })).rejects.toThrow(/already exists/);

      // A numeric filter matches the number, never the string.
      await store.delete(primary, "numeric_ids", {});
      await store.insert(primary, "numeric_ids", { id: 1, label: "number" });
      await store.insert(primary, "numeric_ids", { id: "1x", label: "string" });
      const numeric = await store.find(primary, "numeric_ids", { filter: { id: 1 } });
      expect(numeric.data.map((d) => String(d.id))).toEqual(["1"]);
      expect(await store.count(primary, "numeric_ids", { id: 1 })).toBe(1);

      // ...and a string filter on a numeric field still matches by text.
      const textual = await store.find(primary, "numeric_ids", { filter: { id: "1" } });
      expect(textual.data.map((d) => String(d.id))).toEqual(["1"]);

      // Comparisons on a numeric field must not sweep in string values either.
      const gt = await store.find(primary, "numeric_ids", { filter: { id: { $gt: 0 } } });
      expect(gt.data.map((d) => String(d.id))).toEqual(["1"]);

      await store.delete(primary, "numeric_ids", {});
    });

    it("updates with merge, $set, $inc and single-row cap", async () => {
      const n1 = await store.update(primary, "orders", { id: "a" }, { status: "refunded" }, false);
      expect(n1).toBe(1);
      const after1 = await store.get(primary, "orders", "a");
      expect((after1?.document as { status?: string } | null)?.status).toBe("refunded");

      const n2 = await store.update(primary, "orders", { id: "a" }, { $inc: { total: 10 } }, false);
      expect(n2).toBe(1);
      const after2 = await store.get(primary, "orders", "a");
      expect((after2?.document as { total?: number } | null)?.total).toBe(150);

      const n3 = await store.update(primary, "orders", {}, { $set: { touched: true } }, false);
      expect(n3).toBe(1); // many=false caps to one row
      expect(n3).toBeLessThanOrEqual(1);
    });

    it("deletes by filter", async () => {
      const n = await store.delete(primary, "orders", { status: "refunded" });
      expect(n).toBe(1);
      const left = await store.find(primary, "orders", {});
      expect(left.data.map((d) => d.id)).toEqual(["b"]);
    });

    it("lists tables with counts", async () => {
      const tables = await store.listTables(primary);
      expect(tables).toEqual([{ name: "orders", count: 1 }]);
    });

    it("rejects unsafe table names", async () => {
      await expect(store.find(primary, "orders; DROP TABLE users", {})).rejects.toThrow(/Invalid identifier/);
    });
  });
}

/**
 * Data-layer tests on a real SQLite engine (in-memory) via the same facade the
 * app uses. All LocalMe business rules that depend on SQL semantics are
 * exercised here in CI — never as a sandbox gate.
 *
 * The document-store assertions live in `document-store.contract.ts` and run
 * against both dialects; this file adds the SQLite-only driver selection rules.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

import type { Db } from "@/lib/server/db/index";
import { getDb } from "@/lib/server/db/index";
import { resolveDriver } from "@/lib/server/db/driver";
import { documentStoreContract } from "./document-store.contract";

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

documentStoreContract({
  label: "sqlite",
  makeDb,
  primaryProjectId: 1,
  secondaryProjectId: 2,
});

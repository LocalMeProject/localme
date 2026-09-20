/**
 * LocalMe data layer facade.
 *
 * A single dialect-agnostic interface (Db) implemented once per driver and
 * selected at boot from DB_DRIVER (see driver.ts). Application code imports
 * `getDb()` and never touches a driver package directly. Driver modules load
 * lazily so a SQLite runtime never pulls `pg` into its dependency graph and
 * vice versa.
 */
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as pgSchema from "./postgres/schema";
import * as sqSchema from "./sqlite/schema";
import { resolveDriver, type DbDriver, type DbEndpoint } from "./driver";

/** Contract every dialect client fulfills. */
export interface Db {
  readonly driver: DbDriver;
  sqlite?: BetterSQLite3Database<Record<string, never>>;
  postgres?: NodePgDatabase<Record<string, never>>;
  raw: <T = unknown>(sqlText: string, params?: unknown[]) => Promise<T[]>;
  /** Statement returning a change count (UPDATE/DELETE). */
  run: (sqlText: string, params?: unknown[]) => Promise<{ changes: number }>;
  exec: (sqlText: string) => Promise<void>;
  transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;
}

class SqliteDb implements Db {
  readonly driver = "sqlite" as const;
  readonly sqlite: BetterSQLite3Database<Record<string, never>>;
  readonly #runner: import("better-sqlite3").Database;

  constructor(database: import("better-sqlite3").Database) {
    this.#runner = database;
    this.sqlite = drizzleSqlite(database);
  }

  async raw<T = unknown>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.#runner.prepare(sqlText);
    return stmt.all(...params) as T[];
  }

  async run(sqlText: string, params: unknown[] = []): Promise<{ changes: number }> {
    const info = this.#runner.prepare(sqlText).run(...params);
    return { changes: Number(info.changes) };
  }

  async exec(sqlText: string): Promise<void> {
    this.#runner.exec(sqlText);
  }

  /**
   * Transaction with async-callback support.
   *
   * better-sqlite3's native transaction helper only supports synchronous work.
   * Emulating async commit safely needs BEGIN IMMEDIATE/COMMIT around awaited
   * work, which this wrapper provides; the callback runs on the event loop with
   * the transaction held open (single-writer SQLite keeps this safe).
   */
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    this.#runner.exec("BEGIN IMMEDIATE");
    try {
      const txDb = new SqliteDb(this.#runner);
      const result = await fn(txDb);
      this.#runner.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.#runner.exec("ROLLBACK");
      } catch {
        /* connection already rolled back; nothing further to do */
      }
      throw error;
    }
  }
}

class PostgresDb implements Db {
  readonly driver = "postgres" as const;
  readonly postgres: NodePgDatabase<Record<string, never>>;
  readonly #pool: import("pg").Pool;

  constructor(pool: import("pg").Pool) {
    this.#pool = pool;
    this.postgres = drizzlePg(pool);
  }

  async raw<T = unknown>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.#pool.query(sqlText, params);
    return result.rows as T[];
  }

  async run(sqlText: string, params: unknown[] = []): Promise<{ changes: number }> {
    const result = await this.#pool.query(sqlText, params);
    return { changes: result.rowCount ?? 0 };
  }

  async exec(sqlText: string): Promise<void> {
    await this.#pool.query(sqlText);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = new PostgresDb({
        // Minimal Pool-like facade around the checked-out client.
        connect: async () => client,
        query: async (text: string, params?: unknown[]) => client.query(text, params as never[]),
        end: async () => undefined,
      } as unknown as import("pg").Pool);
      const result = await fn(txDb);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function createSqlite(endpoint: DbEndpoint): SqliteDb {
  // Lazy require keeps better-sqlite3 out of any Postgres-only runtime path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  const database = endpoint.sqliteDatabase
    ? (endpoint.sqliteDatabase as import("better-sqlite3").Database)
    : endpoint.sqlitePath
      ? new Database(endpoint.sqlitePath.replace(/^file:\/+/, "/"))
      : new Database(":memory:");
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  installRegexp(database);
  return new SqliteDb(database);
}

function createPostgres(endpoint: DbEndpoint): PostgresDb {
  // Lazy require keeps pg out of any SQLite-only runtime path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({
    connectionString: endpoint.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PostgresDb(pool);
}

/**
 * Register `regexp(pattern, text)` on a SQLite connection so the DSL's $regex
 * operator works like Postgres's `~`. JS RegExp semantics apply; queries with
 * invalid patterns fail closed (no match) rather than throwing.
 */
function installRegexp(database: import("better-sqlite3").Database): void {
  database.function("regexp", (pattern: string | null, text: string | null) => {
    if (typeof pattern !== "string" || typeof text !== "string") return 0;
    try {
      return new RegExp(pattern).test(text) ? 1 : 0;
    } catch {
      return 0;
    }
  });
}

let cached: { endpoint: DbEndpoint; db: Db } | undefined;

/** Create (or return the cached) database client for the configured dialect. */
export function getDb(endpoint?: DbEndpoint): Db {
  const resolved = endpoint ?? resolveDriver();
  if (!endpoint && cached && cached.endpoint.driver === resolved.driver) {
    return cached.db;
  }
  const db = resolved.driver === "postgres" ? createPostgres(resolved) : createSqlite(resolved);
  if (!endpoint) cached = { endpoint: resolved, db };
  return db;
}

export { pgSchema, sqSchema };
export type { DbDriver, DbEndpoint };

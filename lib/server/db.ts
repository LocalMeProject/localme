/**
 * @deprecated Superseded by the dialect-agnostic facade in `lib/server/db/index.ts`
 * (DB_DRIVER=sqlite default, postgres switchable — see docs/adr/003).
 * Kept temporarily for reference; will be removed once callers migrate.
 */
import { Pool, type QueryResultRow } from "pg";

declare global {
  var __localmePool: Pool | undefined;
}

/**
 * Shared Pg pool. One pool per process; the global survives dev hot-reload.
 * Works with any Postgres 14+ (Neon pooled URLs, RDS, self-hosted).
 */
function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. LocalMe needs a Postgres connection string (see docs/adr/002).",
    );
  }
  if (globalThis.__localmePool) return globalThis.__localmePool;
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  globalThis.__localmePool = pool;
  return pool;
}

/** Parameterized query — the only way this module exposes SQL. */
export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

/** Run a transaction; rolls back if the callback throws. */
export async function withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn({
      query: async <U extends QueryResultRow>(sql: string, params: unknown[] = []) => {
        const res = await client.query<U>(sql, params);
        return res.rows;
      },
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface TxClient {
  query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Tiny unique-violation helper for friendly 409s. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/**
 * Dialect selection for LocalMe's data layer.
 *
 * - `DB_DRIVER=sqlite` (default) — better-sqlite3 via Drizzle; `DB_PATH` picks a
 *   file (`file:/path/to.db`) or in-memory database when unset.
 * - `DB_DRIVER=postgres` — node-postgres pool via Drizzle; requires `DATABASE_URL`.
 *
 * All application code goes through the adapter in lib/server/db/index.ts and is
 * dialect-agnostic. Driver packages are loaded lazily so each runtime only needs
 * the driver it actually uses (this module must stay free of driver imports).
 */
import { z } from "zod";

export type DbDriver = "sqlite" | "postgres";

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^file:\//, "DB_PATH must start with file:/");

export interface DbEndpoint {
  driver: DbDriver;
  /** SQLite database path (undefined = in-memory). */
  sqlitePath?: string;
  /** Prebuilt SQLite handle (tests); skips path resolution when provided. */
  sqliteDatabase?: unknown;
  /** Postgres connection string. */
  connectionString?: string;
}

/**
 * Resolve the database endpoint from the environment.
 * `env` is injectable for tests; defaults to process.env.
 */
export function resolveDriver(env: Record<string, string | undefined> = process.env): DbEndpoint {
  const raw = env.DB_DRIVER?.trim().toLowerCase() || "sqlite";
  if (raw === "sqlite") {
    const path = env.DB_PATH?.trim();
    return { driver: "sqlite", sqlitePath: path ? pathSchema.parse(path) : undefined };
  }
  if (raw === "postgres") {
    const connectionString = env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DB_DRIVER=postgres requires DATABASE_URL (see docs/adr/002).");
    }
    return { driver: "postgres", connectionString };
  }
  throw new Error(`Unsupported DB_DRIVER "${raw}". Expected "sqlite" or "postgres".`);
}

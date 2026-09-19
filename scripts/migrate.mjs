#!/usr/bin/env node
/**
 * Migration runner for both dialects.
 *
 * - sqlite:   executes each .sql file as a script (multi-statement) against the
 *             database selected by DB_PATH (in-memory when unset).
 * - postgres: executes each .sql file against DATABASE_URL.
 *
 * Applied files are recorded in a `schema_migrations` ledger and skipped on
 * re-run. Safe to run repeatedly.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const driver = (process.env.DB_DRIVER || "sqlite").trim().toLowerCase();

async function migrateSqlite() {
  // Lazy require keeps driver imports out of the Postgres path.
  const { default: Database } = await import("better-sqlite3");
  const path = process.env.DB_PATH?.trim();
  const db = new Database(path ? path.replace(/^file:\/+/, "/") : ":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    dialect TEXT NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dialect, name)
  )`);

  const dir = join(ROOT, "db", "sqlite");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set(
    db.prepare(`SELECT name FROM schema_migrations WHERE dialect = 'sqlite'`).all().map((r) => r.name),
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = readFileSync(join(dir, file), "utf8");
    db.transaction(() => db.exec(sqlText))();
    db.prepare(`INSERT INTO schema_migrations (dialect, name) VALUES ('sqlite', ?)`).run(file);
    console.log(`[sqlite] applied ${file}`);
  }
  db.close();
}

async function migratePostgres() {
  const { default: pg } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DB_DRIVER=postgres requires DATABASE_URL");
    process.exitCode = 1;
    return;
  }
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      dialect TEXT NOT NULL,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (dialect, name)
    )`);

    const dir = join(ROOT, "db", "postgres");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query(`SELECT name FROM schema_migrations WHERE dialect = 'postgres'`);
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlText = readFileSync(join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sqlText);
        await client.query(`INSERT INTO schema_migrations (dialect, name) VALUES ('postgres', $1)`, [file]);
        await client.query("COMMIT");
        console.log(`[postgres] applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (driver === "postgres") {
  await migratePostgres();
} else if (driver === "sqlite") {
  await migrateSqlite();
} else {
  console.error(`Unsupported DB_DRIVER "${driver}" (expected sqlite or postgres)`);
  process.exitCode = 1;
}

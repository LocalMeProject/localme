#!/usr/bin/env node
/**
 * System database backups (Blueprint §9.3).
 *
 *   "User-initiated: Export via dashboard (ZIP).
 *    System: PostgreSQL daily pg_dump (retention: 30 days).
 *    File system: not backed up by platform (users export manually)."
 *
 * This is the system half. Project content (files, documents, configuration)
 * is the user's to export through the dashboard; this script protects the
 * platform database itself.
 *
 * Usage:
 *   node scripts/backup.mjs              # take a backup, then prune
 *   node scripts/backup.mjs --list       # show existing backups with sizes
 *   node scripts/backup.mjs --verify     # take one and verify it is readable
 *   node scripts/backup.mjs --restore <file>
 *   node scripts/backup.mjs --db file:/var/lib/localme/localme.db --dir ./backups
 *   BACKUP_DIR=./backups RETENTION_DAYS=60 node scripts/backup.mjs
 *
 * The connection string is never printed: pg_dump and pg_restore read it from
 * the environment, and every message below prints the *file* instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

// Flags win over the environment, so the script can be exercised (and driven
// from a scheduler) without exporting variables first.
const BACKUP_DIR = resolve(valueAfter("--dir") ?? process.env.BACKUP_DIR ?? "backups");
const RETENTION_DAYS = Number(valueAfter("--retention-days") ?? process.env.RETENTION_DAYS ?? 30);
const DRIVER = (valueAfter("--driver") ?? process.env.DB_DRIVER ?? "sqlite").toLowerCase();
const DB_PATH = valueAfter("--db") ?? process.env.DB_PATH ?? "";

function fail(message) {
  console.error(`[backup] ${message}`);
  process.exitCode = 1;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pgTool(tool) {
  const result = spawnSync(tool, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

/** SQLite path from `DB_PATH=file:/abs/path.db` or a bare path. */
function sqliteFile() {
  if (!DB_PATH) return null;
  const raw = DB_PATH.startsWith("file:") ? DB_PATH.slice("file:".length) : DB_PATH;
  return raw === ":memory:" ? null : raw;
}

async function takeBackup() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  if (DRIVER === "postgres") {
    if (!process.env.DATABASE_URL) {
      fail("DATABASE_URL is required for a Postgres backup.");
      return null;
    }
    if (!pgTool("pg_dump")) {
      fail("pg_dump is not on PATH. Install the Postgres client tools, or set DB_DRIVER=sqlite.");
      return null;
    }
    const file = join(BACKUP_DIR, `localme-${timestamp()}.dump`);
    // pg_dump reads DATABASE_URL from the environment; it is never on the argv
    // (which would expose it in the process table).
    const result = spawnSync(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", file],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (result.status !== 0) {
      fail(`pg_dump exited with status ${result.status}.`);
      return null;
    }
    console.log(`[backup] wrote ${file} (${formatBytes(statSync(file).size)})`);
    return file;
  }

  const source = sqliteFile();
  if (!source) {
    fail("No SQLite database file configured (DB_PATH unset or :memory:). Nothing to back up.");
    return null;
  }
  if (!existsSync(source)) {
    fail(`SQLite database not found at ${source}.`);
    return null;
  }
  const file = join(BACKUP_DIR, `localme-${timestamp()}.db`);
  // A file copy of a live SQLite database can be torn; the online backup API
  // (VACUUM INTO) is the consistent one and ships with better-sqlite3.
  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(source, { readonly: true });
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    db.close();
    console.log(`[backup] wrote ${file} (${formatBytes(statSync(file).size)})`);
    return file;
  } catch (error) {
    // Fall back to a plain copy if VACUUM INTO is unavailable, and say so.
    copyFileSync(source, file);
    console.warn(`[backup] VACUUM INTO failed (${error.message}); fell back to a file copy.`);
    console.log(`[backup] wrote ${file} (${formatBytes(statSync(file).size)})`);
    return file;
  }
}

async function verify(file) {
  if (!file || !existsSync(file)) return fail(`Nothing to verify (${file ?? "no file"}).`);
  const size = statSync(file).size;
  if (size === 0) return fail(`${file} is empty.`);
  if (DRIVER === "postgres") {
    if (!pgTool("pg_restore")) {
      console.log(`[backup] pg_restore is not on PATH; skipping the read-back check for ${file}.`);
      return;
    }
    const result = spawnSync("pg_restore", ["--list", file], { stdio: ["ignore", "ignore", "ignore"] });
    if (result.status !== 0) fail(`pg_restore --list failed for ${file}.`);
    else console.log(`[backup] verified ${file} (${formatBytes(size)}, readable TOC).`);
    return;
  }
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(file, { readonly: true });
  const tables = db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'")
    .get();
  db.close();
  console.log(`[backup] verified ${file} (${formatBytes(size)}, ${tables.n} tables).`);
}

function prune() {
  if (!existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  let removed = 0;
  let freed = 0;
  for (const name of readdirSync(BACKUP_DIR)) {
    if (!/\.(dump|db)$/.test(name)) continue;
    const file = join(BACKUP_DIR, name);
    const stats = statSync(file);
    if (stats.mtimeMs >= cutoff) continue;
    rmSync(file, { force: true });
    removed += 1;
    freed += stats.size;
  }
  if (removed > 0) {
    console.log(`[backup] pruned ${removed} backup(s) older than ${RETENTION_DAYS} days (${formatBytes(freed)}).`);
  }
}

function list() {
  if (!existsSync(BACKUP_DIR)) {
    console.log(`[backup] no backup directory at ${BACKUP_DIR}.`);
    return;
  }
  const files = readdirSync(BACKUP_DIR)
    .filter((name) => /\.(dump|db)$/.test(name))
    .map((name) => {
      const stats = statSync(join(BACKUP_DIR, name));
      return { name, size: stats.size, age_days: Math.round((Date.now() - stats.mtimeMs) / 86_400_000) };
    })
    .sort((a, b) => b.age_days - a.age_days);
  if (files.length === 0) {
    console.log(`[backup] no backups in ${BACKUP_DIR}.`);
    return;
  }
  console.log(`[backup] ${files.length} backup(s) in ${BACKUP_DIR}:`);
  for (const file of files) {
    console.log(`  ${file.name}  ${formatBytes(file.size)}  ${file.age_days}d old`);
  }
}

function restore(file) {
  const target = resolve(file);
  if (!existsSync(target)) return fail(`No such backup: ${file}`);
  if (DRIVER === "postgres") {
    if (!process.env.DATABASE_URL) return fail("DATABASE_URL is required to restore a Postgres backup.");
    if (!pgTool("pg_restore")) return fail("pg_restore is not on PATH.");
    console.log("[backup] restoring into the configured database; this replaces current data.");
    const result = spawnSync("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--dbname", target], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (result.status !== 0) return fail(`pg_restore exited with status ${result.status}.`);
    console.log(`[backup] restored ${target}.`);
    return;
  }
  const source = sqliteFile();
  if (!source) return fail("No SQLite database file configured to restore into.");
  copyFileSync(target, source);
  console.log(`[backup] restored ${target} into ${source}.`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Keep the linter honest about the unused import in the ESM path above.
if (has("--list")) {
  list();
} else if (has("--restore")) {
  const file = args[args.indexOf("--restore") + 1];
  if (!file) fail("--restore needs a file path.");
  else restore(file);
} else {
  const file = await takeBackup();
  if (file && has("--verify")) await verify(file);
  prune();
  if (!has("--verify")) list();
}

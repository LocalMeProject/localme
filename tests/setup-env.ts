/**
 * Vitest setup, loaded before any test module.
 *
 * The suite must never touch the developer's own database. `.env.local` is
 * loaded into every shell in the workspace, so `DB_PATH` pointed at
 * `data/localme.db` meant `bun run test` opened the *real* development
 * database — and the cleanup in a test file silently deleted it.
 *
 * Each worker therefore gets its own in-memory SQLite. The Postgres leg
 * (`bun run test:postgres`) deliberately sets DB_DRIVER=postgres with its own
 * throwaway URL, so it is left untouched.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if ((process.env.DB_DRIVER ?? "sqlite").trim().toLowerCase() !== "postgres") {
  delete process.env.DB_PATH;
  delete process.env.DATABASE_URL;
}

if (!process.env.STORAGE_DATA_DIR) {
  process.env.STORAGE_DATA_DIR = mkdtempSync(join(tmpdir(), "localme-test-storage-"));
}

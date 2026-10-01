/**
 * The one implementation of "what does DB_PATH mean".
 *
 * Shared by the application (`lib/server/db/driver.ts`, TypeScript) and the
 * migration runner (`scripts/migrate.mjs`, plain Node ESM). Node cannot import
 * TypeScript, so this file is the lower common denominator rather than the
 * higher one — that direction is what keeps `db:migrate` and the server from
 * silently opening two different databases.
 *
 * It is `.mjs` rather than `.ts` because the runner must stay Node-runnable:
 * Bun's NAPI layer aborts the process when it loads the `better-sqlite3` native
 * addon this way.
 *
 * Accepted forms (Blueprint §9, env.example):
 *   unset                          -> in-memory (returns undefined)
 *   file:/abs/path.db              -> /abs/path.db
 *   file:///abs/path.db            -> /abs/path.db
 *
 * A relative path is rejected rather than guessed: `file:./data/x.db` is a
 * SQLite URI, not a filesystem path, and silently resolving it against the
 * process's working directory is how you get two databases instead of one.
 */

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined} absolute filesystem path, or undefined for in-memory
 */
export function sqlitePathFrom(env) {
  const raw = env.DB_PATH?.trim();
  if (!raw) return undefined;

  if (!raw.startsWith("file:")) {
    throw new Error("DB_PATH must start with file:/ (see env.example)");
  }
  const path = raw.replace(/^file:\/+/, "/");
  if (!path.startsWith("/")) {
    throw new Error(
      "DB_PATH must be an absolute path, e.g. file:/var/lib/localme/localme.db. " +
        "A relative path is ambiguous and resolves against the working directory, " +
        "which is how the server and the migration runner end up on different databases.",
    );
  }
  return path;
}

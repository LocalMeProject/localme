/**
 * Migration 008 — the shared library becomes a reserved per-user project.
 *
 * The migration re-homes every `library/…` file onto the account's `library`
 * project. Two things make it non-trivial, and both were found by running it
 * against deliberately messy data rather than by reading it:
 *
 *  1. The same path can exist in several of an account's projects *and* already
 *     in the library project, so every copy has to be ranked before anything
 *     moves — otherwise the move violates the unique (project_id, path) index
 *     halfway through and the migration aborts with the data half-migrated.
 *  2. The `library/` prefix is only stripped when it is actually present. A row
 *     already in the library project was stored under its real path, and an
 *     unconditional `substr(path, 9)` truncated `a.css` to the empty string —
 *     a file with no name, invisible in the console and unservable.
 *
 * It runs on a private in-memory database rather than the shared one so the
 * messy fixture cannot leak into another suite.
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

/** Schema up to (but excluding) 008, applied to a private in-memory database. */
function freshDb(): Database.Database {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of [
    "001_init.sql",
    "002_files_and_rate_limits.sql",
    "003_platform_completion.sql",
    "004_route_permissions.sql",
    "005_webhook_outbox.sql",
    "006_acme_challenges.sql",
    "007_document_id_text_semantics.sql",
  ]) {
    database.exec(readFileSync(join(dir, file), "utf8"));
  }
  return database;
}

function apply008(database: Database.Database): void {
  database.exec(readFileSync(join(process.cwd(), "db", "sqlite", "008_library_namespace.sql"), "utf8"));
}

function addFile(
  database: Database.Database,
  projectId: number,
  path: string,
  updatedAt: string,
): void {
  database
    .prepare(
      `INSERT INTO files (project_id, path, is_text, content_text, content_blob, size_bytes, updated_at)
       VALUES (?, ?, 1, 'x', ?, 10, ?)`,
    )
    .run(projectId, path, Buffer.from("y".repeat(10)), updatedAt);
}

describe("migration 008 — library becomes a reserved per-user project", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
    for (const id of [10, 11, 12, 13]) {
      db.prepare("INSERT INTO projects (id, user_id, name) VALUES (?, 1, ?)").run(id, `p${id}`);
    }
  });

  it("folds copies of one path into a single library row, newest first", () => {
    // One path spread across four projects, including an exact timestamp tie
    // (broken by lowest id) and a copy that is already in the library project.
    addFile(db, 10, "library/a.css", "2024-01-01 00:00:00");
    addFile(db, 11, "library/a.css", "2024-01-01 00:00:00");
    addFile(db, 12, "library/a.css", "2024-06-01 00:00:00");
    addFile(db, 13, "library/a.css", "2025-01-01 00:00:00"); // newest → survives
    db.prepare("INSERT INTO projects (id, user_id, name, free_visits_per_month) VALUES (99, 1, 'library', 0)").run();
    addFile(db, 99, "a.css", "2024-02-01 00:00:00"); // already in the library project

    apply008(db);

    const library = db
      .prepare("SELECT path, updated_at FROM files WHERE project_id = 99 ORDER BY path")
      .all();
    expect(library).toEqual([{ path: "a.css", updated_at: "2025-01-01 00:00:00" }]);
    // Nothing is stranded in a normal project, and no prefixed row survives.
    expect(db.prepare("SELECT COUNT(*) AS n FROM files WHERE project_id != 99").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM files WHERE path LIKE 'library/%'").get()).toEqual({ n: 0 });
  });

  it("never truncates a path that has no library/ prefix", () => {
    // The regression: an unconditional substr(path, 9) turned `a.css` into the
    // empty string here, producing a file with no name.
    db.prepare("INSERT INTO projects (id, user_id, name, free_visits_per_month) VALUES (99, 1, 'library', 0)").run();
    addFile(db, 99, "a.css", "2024-02-01 00:00:00");
    addFile(db, 99, "css/b.css", "2024-02-02 00:00:00");

    apply008(db);

    const paths = db.prepare("SELECT path FROM files WHERE project_id = 99 ORDER BY path").all();
    expect(paths).toEqual([{ path: "a.css" }, { path: "css/b.css" }]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM files WHERE path = '' OR path IS NULL").get()).toEqual({ n: 0 });
  });

  it("keeps nested paths and creates the library project per account", () => {
    addFile(db, 10, "library/css/b.css", "2024-03-01 00:00:00");
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (2, 'u2', 'x')").run();
    db.prepare("INSERT INTO projects (id, user_id, name) VALUES (20, 2, 'theirs')").run();
    addFile(db, 20, "library/z.css", "2024-03-02 00:00:00");

    apply008(db);

    // Each account gets its own library, and only its own files.
    const libraries = db
      .prepare(
        `SELECT u.username, f.path FROM projects p
         JOIN users u ON u.id = p.user_id
         JOIN files f ON f.project_id = p.id
         WHERE p.name = 'library' ORDER BY u.username, f.path`,
      )
      .all();
    expect(libraries).toEqual([
      { username: "u1", path: "css/b.css" },
      { username: "u2", path: "z.css" },
    ]);
  });

  it("is safe on an account that never used the library", () => {
    db.prepare("INSERT INTO projects (id, user_id, name) VALUES (30, 1, 'empty')").run();
    expect(() => apply008(db)).not.toThrow();
    // No library project is conjured for an account that has nothing to move.
    expect(db.prepare("SELECT COUNT(*) AS n FROM projects WHERE name = 'library'").get()).toEqual({ n: 0 });
  });
});

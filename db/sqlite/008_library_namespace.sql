-- Migration 008 (SQLite): the shared library becomes a reserved per-user project.
-- Postgres twin: db/postgres/008_library_namespace.sql
--
-- The library used to be a `library/` folder inside whichever project the owner
-- happened to upload to, which meant the same asset could exist in several
-- projects and the console had to reconcile copies. It is now one project named
-- `library` per account, served from /{username}/library/<path>.
--
-- This moves what is already there. Rows are re-homed onto the owner's library
-- project with the `library/` prefix stripped, so `library/reset.css` inside
-- `atlas-dashboard` becomes `reset.css` in that account's library — the same
-- bytes at the URL the new model serves them from, so no asset is lost and no
-- reference in a deployed page breaks.
--
-- The same path can exist in several of an account's projects, and the target
-- project may already hold a copy too, so every candidate is ranked before
-- anything moves: newest `updated_at` wins, ties broken by the lowest id, and
-- only that one row survives. Ranking first is what keeps the move from
-- colliding on the unique (project_id, path) index.

INSERT OR IGNORE INTO projects (user_id, name, free_visits_per_month)
SELECT DISTINCT pr.user_id, 'library', 0
FROM files f
JOIN projects pr ON pr.id = f.project_id
WHERE f.path LIKE 'library/%';

-- Rank every copy of every library path in the account, whether it currently
-- sits in a normal project (under the prefix) or already in the library.
--
-- The prefix is stripped only when it is actually there. A row already in the
-- library project was stored under its real path, so an unconditional
-- substr(path, 9) truncated `a.css` to the empty string and produced a file
-- with no name — invisible in the console and unservable.
DROP TABLE IF EXISTS temp_library_copies;

CREATE TEMP TABLE temp_library_copies AS
SELECT f.id AS file_id,
       pr.user_id AS user_id,
       CASE WHEN f.path LIKE 'library/%' THEN substr(f.path, 9) ELSE f.path END AS new_path,
       f.updated_at AS updated_at,
       ROW_NUMBER() OVER (
         PARTITION BY pr.user_id, CASE WHEN f.path LIKE 'library/%' THEN substr(f.path, 9) ELSE f.path END
         ORDER BY f.updated_at DESC, f.id ASC
       ) AS rank_in_path
FROM files f
JOIN projects pr ON pr.id = f.project_id
WHERE f.path LIKE 'library/%'
   OR pr.name = 'library';

-- Keep the winner for each (account, path); drop every other copy, wherever it
-- currently lives.
DELETE FROM files
WHERE id IN (
  SELECT file_id FROM temp_library_copies WHERE rank_in_path > 1
);

-- Re-home the survivors onto the account's library project.
UPDATE files
SET project_id = (
        SELECT lib.id FROM projects lib
        WHERE lib.user_id = temp_library_copies.user_id AND lib.name = 'library'
      ),
    path = temp_library_copies.new_path
FROM temp_library_copies
WHERE files.id = temp_library_copies.file_id
  AND temp_library_copies.rank_in_path = 1;

DROP TABLE temp_library_copies;

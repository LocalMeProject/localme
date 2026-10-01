-- Migration 008 (Postgres): the shared library becomes a reserved per-user project.
-- SQLite twin: db/sqlite/008_library_namespace.sql
--
-- See the SQLite twin for the rationale: the library used to be a `library/`
-- folder inside an arbitrary project and is now one project named `library` per
-- account, served from /{username}/library/<path>. Existing rows are re-homed
-- with the prefix stripped so no asset is lost and no deployed reference breaks.
--
-- The same path can exist in several of an account's projects, and the target
-- project may already hold a copy, so every candidate is ranked before anything
-- moves: newest `updated_at` wins, ties broken by the lowest id, and only that
-- one row survives. Ranking first is what keeps the move from colliding on the
-- unique (project_id, path) constraint.

INSERT INTO projects (user_id, name, free_visits_per_month)
SELECT DISTINCT pr.user_id, 'library', 0
FROM files f
JOIN projects pr ON pr.id = f.project_id
WHERE f.path LIKE 'library/%'
ON CONFLICT (user_id, name) DO NOTHING;

-- Rank every copy of every library path in the account, whether it currently
-- sits in a normal project (under the prefix) or already in the library.
--
-- The prefix is stripped only when it is actually there. A row already in the
-- library project was stored under its real path, so an unconditional
-- substr(path, 9) truncated `a.css` to the empty string and produced a file
-- with no name — invisible in the console and unservable.
CREATE TEMP TABLE library_copies ON COMMIT DROP AS
SELECT f.id AS file_id,
       pr.user_id AS user_id,
       CASE WHEN f.path LIKE 'library/%' THEN substr(f.path, 9) ELSE f.path END AS new_path,
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
WHERE id IN (SELECT file_id FROM library_copies WHERE rank_in_path > 1);

-- Re-home the survivors onto the account's library project.
UPDATE files f
SET project_id = lib.id,
    path = c.new_path
FROM library_copies c
JOIN projects lib ON lib.user_id = c.user_id AND lib.name = 'library'
WHERE f.id = c.file_id
  AND c.rank_in_path = 1;

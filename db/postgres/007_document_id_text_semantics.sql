-- Migration 007 (Postgres): document ids are compared as text, matching SQLite.
-- SQLite twin: db/sqlite/007_document_id_text_semantics.sql
--
-- The index expression `(document->>'id')` is already text-cast here, so the
-- only change is the repair step. It keeps this file symmetric with the SQLite
-- twin and guards the one case that can have drifted: data written while
-- `DB_DRIVER=sqlite` was in use, then moved to Postgres. Duplicates collapse to
-- the oldest row; rows with no id are untouched.

DROP INDEX IF EXISTS uq_project_data_doc_id;

DELETE FROM project_data
WHERE (document->>'id') IS NOT NULL
  AND id NOT IN (
    SELECT MIN(pd.id)
    FROM project_data pd
    WHERE (pd.document->>'id') IS NOT NULL
    GROUP BY pd.project_id, pd.table_name, (pd.document->>'id')
  );

CREATE UNIQUE INDEX uq_project_data_doc_id
    ON project_data (project_id, table_name, (document->>'id'));

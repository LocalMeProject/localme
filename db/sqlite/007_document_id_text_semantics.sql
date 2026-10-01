-- Migration 007 (SQLite): document ids are compared as text, matching Postgres.
-- Postgres twin: db/postgres/007_document_id_text_semantics.sql
--
-- §4.2 says a document id is "1 and \"1\" are the same id", which is true on
-- Postgres because `document->>'id'` always text-casts. SQLite's `json_extract`
-- is type-preserving: a JSON number comes back INTEGER, so the old index
-- treated `1` and `"1"` as different values and let both into a table. The
-- compiled DSL now casts with `CAST(json_extract(...) AS TEXT)` (see
-- lib/server/db/sql.ts `jsonPathText`); this migration aligns the index with it.
--
-- The repair step is what makes the new unique index safe to build on an
-- existing database: it drops rows whose id duplicates an earlier row in the
-- same (project_id, table_name), keeping the oldest. Rows with no id are left
-- alone — `insert` already rejects them, and SQLite does not constrain NULLs
-- in a unique index anyway.

DROP INDEX IF EXISTS uq_project_data_doc_id;

DELETE FROM project_data
WHERE json_extract(document, '$.id') IS NOT NULL
  AND id NOT IN (
    SELECT MIN(pd.id)
    FROM project_data pd
    WHERE json_extract(pd.document, '$.id') IS NOT NULL
    GROUP BY pd.project_id, pd.table_name, CAST(json_extract(pd.document, '$.id') AS TEXT)
  );

CREATE UNIQUE INDEX uq_project_data_doc_id
    ON project_data (project_id, table_name, CAST(json_extract(document, '$.id') AS TEXT));

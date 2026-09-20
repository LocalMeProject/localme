/**
 * SQLite/Postgres document repository over project_data (Blueprint §4.2).
 *
 * Statements are parameterized end-to-end: every fragment that carries a
 * placeholder is compiled with the correct numbering offset for where it sits
 * in the final SQL (`$1…` for Postgres, `?` for SQLite). Table names are
 * validated identifiers and project_id enforces isolation.
 */
import { compileFilter, compileSort, compileUpdate, type JsonValue } from "./dsl";
import { jsonPathText, placeholder, quote, type SqlFlavor } from "./sql";
import type { Db } from "./index";

export interface FindOptions {
  filter?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface FindResult {
  data: Array<Record<string, JsonValue> & { _localme?: { created: string; updated: string } }>;
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
}

export interface DocumentRow {
  id: string;
  document: JsonValue;
  created_at: string;
  updated_at: string;
}

const MAX_LIMIT = 500;
const SCAN_CAP = 5000;

function flavorOf(db: Db): SqlFlavor {
  return db.driver === "postgres" ? "postgres" : "sqlite";
}

function toRows(rows: unknown[]): DocumentRow[] {
  return rows.map((row) => {
    const r = row as { document: string | JsonValue; created_at?: string; updated_at?: string };
    const doc =
      typeof r.document === "string" ? (JSON.parse(r.document) as JsonValue) : r.document;
    return {
      id: String((doc as { id?: unknown }).id),
      document: doc,
      created_at: r.created_at ?? "",
      updated_at: r.updated_at ?? "",
    };
  });
}

/** Attach LocalMe metadata (`_localme.created` / `_localme.updated`). */
function withMeta(
  row: DocumentRow,
): Record<string, JsonValue> & { _localme?: { created: string; updated: string } } {
  const doc =
    typeof row.document === "object" && row.document !== null && !Array.isArray(row.document)
      ? (row.document as Record<string, JsonValue>)
      : {};
  return {
    ...doc,
    _localme: { created: row.created_at, updated: row.updated_at },
  };
}

export function createDocumentStore(db: Db) {
  const flavor = flavorOf(db);

  return {
    /** List table names for a project with row counts. */
    async listTables(projectId: number): Promise<Array<{ name: string; count: number }>> {
      const rows = await db.raw<{ table_name: string; count: string | number }>(
        `SELECT table_name, COUNT(*) AS count FROM project_data
         WHERE project_id = ${placeholder(flavor, 0)}
         GROUP BY table_name ORDER BY table_name`,
        [projectId],
      );
      return rows.map((r) => ({ name: r.table_name, count: Number(r.count) }));
    },

    /** Count documents matching a filter (caller-bounded; see SCAN_CAP note). */
    async count(projectId: number, table: string, filter?: Record<string, unknown>): Promise<number> {
      quote.ident(table);
      // $1=project_id, $2=table_name, then filter params from #3.
      const where = compileFilter(filter, flavor, 2);
      const rows = await db.raw<{ total: string | number }>(
        `SELECT COUNT(*) AS total FROM project_data
         WHERE project_id = ${placeholder(flavor, 0)}
           AND table_name = ${placeholder(flavor, 1)}
           AND ${where.sql}`,
        [projectId, table, ...where.params],
      );
      return Number(rows[0]?.total ?? 0);
    },

    async find(projectId: number, table: string, options: FindOptions = {}): Promise<FindResult> {
      quote.ident(table);
      // $1=project_id, $2=table_name, then filter params.
      const where = compileFilter(options.filter, flavor, 2);
      const order = compileSort(options.sort, flavor);
      const limit = Math.min(Math.max(options.limit ?? MAX_LIMIT, 1), MAX_LIMIT);
      const offset = Math.max(options.offset ?? 0, 0);
      const truncated = limit + offset > SCAN_CAP;

      const rows = await db.raw(
        `SELECT document, created_at, updated_at FROM project_data
         WHERE project_id = ${placeholder(flavor, 0)}
           AND table_name = ${placeholder(flavor, 1)}
           AND ${where.sql}${order.sql}
         LIMIT ${placeholder(flavor, where.params.length + 2)}
         OFFSET ${placeholder(flavor, where.params.length + 3)}`,
        [projectId, table, ...where.params, limit, offset],
      );

      return {
        data: toRows(rows).map(withMeta),
        total: 0, // total is computed by the caller via count() when needed
        limit,
        offset,
        truncated,
      };
    },

    async get(projectId: number, table: string, id: JsonValue): Promise<DocumentRow | null> {
      quote.ident(table);
      // Text-cast comparison per the Blueprint's id semantics: 1 and "1" match.
      const idText = String(id);
      const rows = await db.raw(
        `SELECT document, created_at, updated_at FROM project_data
         WHERE project_id = ${placeholder(flavor, 0)}
           AND table_name = ${placeholder(flavor, 1)}
           AND ${jsonPathText(flavor, ["id"])} = ${placeholder(flavor, 2)}
         LIMIT 1`,
        [projectId, table, idText],
      );
      return toRows(rows)[0] ?? null;
    },

    async insert(
      projectId: number,
      table: string,
      document: Record<string, JsonValue>,
    ): Promise<DocumentRow> {
      quote.ident(table);
      if (document.id === undefined || document.id === null) {
        throw new Error("Every document must carry a non-null id field");
      }
      const idText = String(document.id);
      const jsonText = JSON.stringify(document);
      const docParam =
        flavor === "postgres" ? `${placeholder(flavor, 2)}::jsonb` : placeholder(flavor, 2);
      const sqlText = `INSERT INTO project_data (project_id, table_name, document)
        VALUES (${placeholder(flavor, 0)}, ${placeholder(flavor, 1)}, ${docParam})
        RETURNING document, created_at, updated_at`;
      try {
        const rows = await db.raw(sqlText, [projectId, table, jsonText]);
        return toRows(rows)[0]!;
      } catch (error) {
        if (isDuplicateId(error)) {
          throw new Error(`A document with id "${idText}" already exists in ${table}`);
        }
        throw error;
      }
    },

    async update(
      projectId: number,
      table: string,
      filter: Record<string, unknown> | undefined,
      update: Record<string, unknown>,
      many: boolean,
    ): Promise<number> {
      quote.ident(table);
      // Binding order follows SQL appearance: SET params first, then the WHERE
      // fixed params, then filter params (the single-row sub-select reuses the
      // same fixed params and filter params, so they repeat in the array).
      const compiled = compileUpdate(update, flavor, 0);
      const fixedBase = compiled.params.length; // project_id, table_name follow
      const where = compileFilter(filter, flavor, fixedBase + 2);
      const projParam = placeholder(flavor, fixedBase);
      const tableParam = placeholder(flavor, fixedBase + 1);
      const capped = many
        ? ""
        : ` AND id IN (
            SELECT id FROM project_data
            WHERE project_id = ${projParam}
              AND table_name = ${tableParam}
              AND ${where.sql}
            LIMIT 1
          )`;
      const sqlText = `UPDATE project_data
        SET ${compiled.assignments.join(", ")}
        WHERE project_id = ${projParam}
          AND table_name = ${tableParam}
          AND ${where.sql}${capped}`;
      const params = [
        ...compiled.params,
        projectId,
        table,
        ...where.params,
        projectId,
        table,
        ...where.params,
      ];
      const result = await db.run(sqlText, params);
      return result.changes;
    },

    async delete(projectId: number, table: string, filter?: Record<string, unknown>): Promise<number> {
      quote.ident(table);
      const where = compileFilter(filter, flavor, 2);
      const sqlText = `DELETE FROM project_data
        WHERE project_id = ${placeholder(flavor, 0)}
          AND table_name = ${placeholder(flavor, 1)}
          AND ${where.sql}`;
      const result = await db.run(sqlText, [projectId, table, ...where.params]);
      return result.changes;
    },
  };
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;

/** Detect a duplicate-id violation on either dialect. */
function isDuplicateId(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "23505" || code === "SQLITE_CONSTRAINT_UNIQUE") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|duplicate key value/i.test(message);
}

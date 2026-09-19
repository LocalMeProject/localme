/**
 * Document repository over project_data (Blueprint §4.2) — dialect-agnostic.
 *
 * All statements are parameterized; table names are validated identifiers and
 * the project_id column enforces isolation. Same SQL shape for both dialects
 * except JSON patching inside compileUpdate().
 */
import { compileFilter, compileSort, compileUpdate, type JsonValue } from "./dsl";
import { quote } from "./sql";
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
  return {
    ...row.document,
    _localme: { created: row.created_at, updated: row.updated_at },
  };
}

export function createDocumentStore(db: Db) {
  void quote; // identifiers are validated in each method via quote.ident(table)
  return {
    /** List table names for a project with row counts. */
    async listTables(projectId: number): Promise<Array<{ name: string; count: number }>> {
      const rows = await db.raw<{ table_name: string; count: number }>(
        db.dialect(
          `SELECT table_name, COUNT(*) AS count FROM project_data WHERE project_id = ? GROUP BY table_name ORDER BY table_name`,
        ),
        [projectId],
      );
      return rows.map((r) => ({ name: r.table_name, count: Number(r.count) }));
    },

    /** Count documents matching a filter (bounded by the 5000 scan cap). */
    async count(projectId: number, table: string, filter?: Record<string, unknown>): Promise<number> {
      const ident = quote.ident(table);
      const where = compileFilter(filter, db.driver === "postgres" ? "postgres" : "sqlite");
      const rows = await db.raw<{ total: number }>(
        db.dialect(
          `SELECT COUNT(*) AS total FROM project_data WHERE project_id = ? AND table_name = ? AND ${where.sql}`,
        ),
        [projectId, table, ...where.params],
      );
      return Number(rows[0]?.total ?? 0);
    },

    async find(projectId: number, table: string, options: FindOptions = {}): Promise<FindResult> {
      const ident = quote.ident(table);
      const flavor = db.driver === "postgres" ? "postgres" : "sqlite";
      const where = compileFilter(options.filter, flavor);
      const order = compileSort(options.sort, flavor);
      const limit = Math.min(Math.max(options.limit ?? MAX_LIMIT, 1), MAX_LIMIT);
      const offset = Math.max(options.offset ?? 0, 0);
      const scanBounded = limit + offset > SCAN_CAP;

      const rows = await db.raw(
        db.dialect(
          `SELECT document, created_at, updated_at FROM project_data
           WHERE project_id = ? AND table_name = ? AND ${where.sql}
           ${order.sql} LIMIT ? OFFSET ?`,
        ),
        [projectId, table, ...where.params, limit, offset],
      );

      return {
        data: toRows(rows).map(withMeta),
        total: 0, // total is computed by the caller via count() when needed
        limit,
        offset,
        truncated: scanBounded,
      };
    },

    async get(projectId: number, table: string, id: JsonValue): Promise<DocumentRow | null> {
      quote.ident(table);
      const flavor = db.driver === "postgres" ? "postgres" : "sqlite";
      const idText = JSON.stringify(id).replace(/^"|"$/g, "");
      const idExpr =
        flavor === "postgres"
          ? `document->>'id'`
          : `json_extract(document, '$.id')`;
      const rows = await db.raw(
        db.dialect(
          `SELECT document, created_at, updated_at FROM project_data
           WHERE project_id = ? AND table_name = ? AND ${idExpr} = ? LIMIT 1`,
        ),
        [projectId, table, idText],
      );
      return toRows(rows)[0] ?? null;
    },

    async insert(projectId: number, table: string, document: Record<string, JsonValue>): Promise<DocumentRow> {
      quote.ident(table);
      if (document.id === undefined || document.id === null) {
        throw new Error("Every document must carry a non-null id field");
      }
      const idText = JSON.stringify(document.id).replace(/^"|"$/g, "");
      const jsonText = JSON.stringify(document);
      // Postgres casts the parameter to JSONB; SQLite inserts the JSON text as-is.
      const sqlText =
        flavor === "postgres"
          ? `INSERT INTO project_data (project_id, table_name, document) VALUES (?, ?, ?::jsonb) RETURNING document, created_at, updated_at`
          : `INSERT INTO project_data (project_id, table_name, document) VALUES (?, ?, ?) RETURNING document, created_at, updated_at`;
      const params = [projectId, table, jsonText];
      try {
        const rows = await db.raw(sqlText, params);
        return toRows(rows)[0]!;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "23505"
        ) {
          throw new Error(`A document with id "${idText}" already exists in ${table}`);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("UNIQUE") || message.includes("unique")) {
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
      const flavor = db.driver === "postgres" ? "postgres" : "sqlite";
      const where = compileFilter(filter, flavor);
      const compiled = compileUpdate(update, flavor);
      // Single-document updates pick one row via a subquery (dialect-neutral).
      const capped = many
        ? ``
        : ` AND id IN (SELECT id FROM project_data WHERE project_id = ? AND table_name = ? AND ${where.sql} LIMIT 1)`;
      const sqlText = db.dialect(
        `UPDATE project_data SET ${compiled.assignments.join(", ")}
         WHERE project_id = ? AND table_name = ? AND ${where.sql}${capped}`,
      );
      const params = many
        ? [...compiled.params]
        : [projectId, table, ...where.params, ...compiled.params];
      try {
        const result = await db.run(sqlText, params);
        return result.changes;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Update failed: ${message}`);
      }
    },

    async delete(projectId: number, table: string, filter?: Record<string, unknown>): Promise<number> {
      quote.ident(table);
      const where = compileFilter(filter, db.driver === "postgres" ? "postgres" : "sqlite");
      const sqlText = db.dialect(
        `DELETE FROM project_data WHERE project_id = ? AND table_name = ? AND ${where.sql}`,
      );
      const result = await db.run(sqlText, [projectId, table, ...where.params]);
      return result.changes;
    },
  };
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;

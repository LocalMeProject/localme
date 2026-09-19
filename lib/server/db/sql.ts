/**
 * Dialect helpers shared by the document-store compiler.
 *
 * Postgres stores documents in JSONB and queries them with `document->'path'`
 * (with `->>'id'` for text-cast id equality per the Blueprint's unique index);
 * SQLite stores documents as TEXT and uses json_extract. Bindings always go
 * through placeholders — user data never interpolates into SQL.
 */
export type SqlFlavor = "postgres" | "sqlite";

/** JSON path expression for a document field, e.g. `document->'tags'->1`. */
export function jsonPathExpr(flavor: SqlFlavor, segments: string[]): string {
  const root = "document";
  if (segments.length === 0) return root;
  if (flavor === "postgres") {
    return `${root}->${segments.map((segment) => `'${escapeKey(segment)}'`).join("->")}`;
  }
  return `json_extract(${root}, '$.${segments.map((segment) => escapeKey(segment)).join(".")}')";
}

/** JSON path expression for a document field, text-cast (`->>` / full text). */
export function jsonPathText(flavor: SqlFlavor, segments: string[]): string {
  if (flavor === "postgres") {
    const root = "document";
    if (segments.length === 0) return root;
    return `${root}->>${segments.map((segment) => `'${escapeKey(segment)}'`).join("->>")}`;
  }
  return jsonPathExpr("sqlite", segments); // json_extract already returns TEXT/NULL
}

function escapeKey(segment: string): string {
  return segment.replace(/'/g, "''");
}

export function placeholder(flavor: SqlFlavor, index: number): string {
  return flavor === "postgres" ? `$${index + 1}` : `?`;
}

export const quote = {
  ident(name: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid identifier: ${name}`);
    }
    return name;
  },
};

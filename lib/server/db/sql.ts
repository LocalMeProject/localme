/**
 * Dialect helpers shared by the document-store compiler.
 *
 * Postgres stores documents in JSONB and queries them with `document->'path'`
 * (with `->>'id'` for text-cast id equality per the Blueprint's unique index);
 * SQLite stores documents as TEXT and uses json_extract. Bindings always go
 * through placeholders — user data never interpolates into SQL.
 */
export type SqlFlavor = "postgres" | "sqlite";

function quotedKey(segment: string): string {
  return `'${segment.replace(/'/g, "''")}'`;
}

/**
 * JSON path expression for a document field (JSON-typed result).
 * Postgres: `document->'a'->'b'` — `->` keeps the JSONB type so the chain nests.
 * SQLite: `json_extract(document, '$.a.b')` — JSON-typed when the value is an
 * object/array, otherwise the SQL text of the scalar.
 */
export function jsonPathExpr(flavor: SqlFlavor, segments: string[]): string {
  if (segments.length === 0) return "document";
  if (flavor === "postgres") {
    return `document->${segments.map(quotedKey).join("->")}`;
  }
  return `json_extract(document, '$.${segments.map(escapeDollarKey).join(".")}')`;
}

/** JSON path expression for a document field, text-cast (`->>` / full text). */
export function jsonPathText(flavor: SqlFlavor, segments: string[]): string {
  if (flavor === "postgres") {
    if (segments.length === 0) return "document::text";
    return `document->>${segments.map(quotedKey).join("->>")}`;
  }
  return jsonPathExpr("sqlite", segments); // json_extract already returns TEXT/NULL
}

function escapeDollarKey(segment: string): string {
  return segment.replace(/'/g, "''").replace(/"/g, '\\"');
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

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

/**
 * JSON path expression for a document field, text-cast (`->>` / full text).
 *
 * The cast is what makes the two dialects agree. Postgres's `->>` always
 * returns text, so `{id: 1}` and `{id: "1"}` are the same document id. SQLite's
 * `json_extract` is type-preserving — a JSON number comes back INTEGER — so
 * comparing it to a bound string never matches and the unique index lets
 * `1` and `"1"` coexist. Casting to TEXT normalises SQLite to Postgres
 * semantics: both dialects treat the id as its text form.
 */
export function jsonPathText(flavor: SqlFlavor, segments: string[]): string {
  if (flavor === "postgres") {
    if (segments.length === 0) return "document::text";
    return `document->>${segments.map(quotedKey).join("->>")}`;
  }
  if (segments.length === 0) return "CAST(document AS TEXT)";
  return `CAST(json_extract(document, '$.${segments.map(escapeDollarKey).join(".")}') AS TEXT)`;
}

/**
 * Expression yielding the JSON *type* of a document field: `number`, `string`,
 * `boolean`, `null`, `object`, `array`, or NULL when the path is absent.
 *
 * Numeric comparisons use this to match only real JSON numbers, so
 * `{ id: 1 }` can never pick up a document whose id is the string `"1"`.
 * Note the two-argument SQLite form `json_type(document, '$.a.b')` — passing an
 * already-extracted value would hand `json_type` a scalar and raise
 * "malformed JSON" for any string field.
 */
export function jsonTypeExpr(flavor: SqlFlavor, segments: string[]): string {
  if (flavor === "postgres") {
    return `jsonb_typeof(${jsonPathExpr(flavor, segments)})`;
  }
  if (segments.length === 0) return "json_type(document)";
  return `json_type(document, '$.${segments.map(escapeDollarKey).join(".")}')`;
}

function escapeDollarKey(segment: string): string {  return segment.replace(/'/g, "''").replace(/"/g, '\\"');
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

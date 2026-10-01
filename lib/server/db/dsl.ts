/**
 * MongoDB-style query DSL → parameterized SQL, compiled per dialect.
 *
 * Operates on the project_data document store (Blueprint §4.2): `table`,
 * `document` (JSON), `project_id`. Supported operators: $eq, $ne, $gt, $gte,
 * $lt, $lte, $in, $nin, $regex, $exists, $and, $or, $not (Blueprint §4.2).
 * Both dialects share one AST (compileFilter); only the leaf predicate SQL and
 * the parameter placeholder differ.
 *
 * Comparison semantics:
 * - Values typed as numbers in the filter compare numerically (numeric cast on
 *   both sides); non-numeric JSON becomes NULL and cannot match — mirroring the
 *   "type-bracket" behavior users expect from Mongo-style stores.
 * - All other values compare on their JSON text form (`->>` on Postgres,
 *   json_extract text on SQLite).
 */
import type { SqlFlavor } from "./sql";
import { jsonPathExpr, jsonPathText, jsonTypeExpr, placeholder } from "./sql";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type FilterObject = { [key: string]: unknown };

export interface CompiledWhere {
  sql: string;
  params: unknown[];
}

interface Ctx {
  flavor: SqlFlavor;
  params: unknown[];
  /** Placeholder numbering offset: statements that embed this fragment after
   * fixed parameters start numbering at `base`. */
  base: number;
}

function addParam(ctx: Ctx, value: unknown): string {
  ctx.params.push(value === undefined ? null : value);
  return placeholder(ctx.flavor, ctx.base + ctx.params.length - 1);
}

/**
 * The three expressions a filter needs for one document field.
 *
 * `num` is deliberately gated on the JSON type. Without that gate both dialects
 * over-match: `filter: { id: 1 }` would also select the document whose id is
 * the *string* `"1"`, because the text form casts cleanly to a number. Gating
 * makes a numeric comparison match only real JSON numbers and evaluate to NULL
 * — never true — for everything else.
 */
interface FieldExprs {
  /** JSON-typed value expression (`->` / `json_extract`). */
  expr: string;
  /** Text-cast value expression (`->>` / `CAST(... AS TEXT)`). */
  text: string;
  /** Numeric comparison expression, gated on a JSON number. */
  num: string;
}

function fieldExprs(flavor: SqlFlavor, segments: string[]): FieldExprs {
  const expr = jsonPathExpr(flavor, segments);
  const type = jsonTypeExpr(flavor, segments);
  return {
    expr,
    text: jsonPathText(flavor, segments),
    num:
      flavor === "postgres"
        ? `CASE WHEN ${type} = 'number' THEN ((${expr}) #>> '{}')::numeric END`
        // SQLite splits Postgres's 'number' into 'integer' and 'real'.
        : `CASE WHEN ${type} IN ('integer', 'real') THEN CAST(${expr} AS REAL) END`,
  };
}

function andGroup(parts: string[]): string {
  return parts.length === 1 ? parts[0]! : parts.map((p) => `(${p})`).join(" AND ");
}

/** The stored JSON as searchable text, for the whole-document `$text` search. */
function documentText(flavor: SqlFlavor): string {
  return flavor === "postgres" ? "document::text" : "CAST(document AS TEXT)";
}

/** Escape a user-typed string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile an operator object (`{ $gt: 18 }`) against a JSON path. */
function compileOperators(ctx: Ctx, field: FieldExprs, ops: FilterObject): string {
  const parts: string[] = [];
  for (const [op, value] of Object.entries(ops)) {
    switch (op) {
      case "$eq": {
        parts.push(equalityPredicate(ctx, field, value));
        break;
      }
      case "$ne": {
        parts.push(`NOT ${equalityPredicate(ctx, field, value)}`);
        break;
      }
      case "$gt":
      case "$gte":
      case "$lt":
      case "$lte": {
        const sqlOp = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op]!;
        const left = comparisonExpr(ctx, field, value);
        parts.push(`(${left} ${sqlOp} ${addParam(ctx, value)})`);
        break;
      }
      case "$in":
      case "$nin": {
        if (!Array.isArray(value)) throw new Error(`${op} expects an array`);
        if (value.length === 0) {
          parts.push(op === "$in" ? "0 = 1" : "1 = 1");
          break;
        }
        const hasNumbers = value.some((v) => typeof v === "number");
        const left = hasNumbers ? field.num : field.text;
        const placeholders = value.map((v) => addParam(ctx, v)).join(", ");
        parts.push(
          op === "$in"
            ? `(${left} IN (${placeholders}))`
            : `NOT (${left} IN (${placeholders}))`,
        );
        break;
      }
      case "$regex": {
        if (typeof value !== "string") throw new Error("$regex expects a string");
        if (ctx.flavor === "postgres") {
          parts.push(`(${field.text} ~ ${addParam(ctx, value)})`);
        } else {
          // SQLite has no native regexp; the `regexp()` scalar function is
          // registered by the SQLite driver (JS RegExp semantics, like pg's ~).
          const escaped = value.replace(/'/g, "''");
          parts.push(
            `(COALESCE(${field.text}, '') REGEXP ${addParam(ctx, escaped)})`,
          );
        }
        break;
      }
      case "$exists": {
        parts.push(value === true ? `(${field.expr} IS NOT NULL)` : `(${field.expr} IS NULL)`);
        break;
      }
      case "$text": {
        // A whole-document substring search. `$regex` only works when you
        // already know which field to look in, which is exactly what a console
        // search box does not.
        if (typeof value !== "string") throw new Error("$text expects a string");
        const pattern = escapeRegExp(value);
        parts.push(
          ctx.flavor === "postgres"
            ? `(${documentText(ctx.flavor)} ~* ${addParam(ctx, pattern)})`
            // SQLite's registered REGEXP is JS RegExp semantics (case
            // sensitive), so the case-insensitivity has to be in the pattern.
            : `(COALESCE(${documentText(ctx.flavor)}, '') REGEXP ${addParam(ctx, `(?i)${pattern}`)})`,
        );
        break;
      }
      default:
        throw new Error(`Unsupported operator "${op}"`);
    }
  }
  return andGroup(parts);
}

/**
 * Equality predicate, dispatched on the filter value's type. Text comparisons
 * use the text-cast expression (`->>` on Postgres): a JSON-typed expr compared
 * to a text param would make Postgres parse the param as JSON and fail.
 */
function equalityPredicate(ctx: Ctx, field: FieldExprs, value: unknown): string {
  if (typeof value === "number") {
    return `(${field.num} = ${addParam(ctx, value)})`;
  }
  if (typeof value === "boolean") {
    // SQLite's json_extract yields JSON true/false as integers 1/0; Postgres's
    // ->> yields the text "true"/"false". Compare per dialect so booleans match.
    if (ctx.flavor === "sqlite") {
      return `(${field.expr} = ${value ? 1 : 0})`;
    }
    return `(LOWER(COALESCE(${field.text}, '')) = ${addParam(ctx, value ? "true" : "false")})`;
  }
  if (value === null) {
    return `(${field.text} IS NULL)`;
  }
  if (typeof value === "object") {
    // Arrays/objects compare on their canonical JSON text.
    return `(${field.text} = ${addParam(ctx, JSON.stringify(value))})`;
  }
  return `(${field.text} = ${addParam(ctx, value)})`;
}

/** Comparison expression matching the type of the filter value. */
function comparisonExpr(ctx: Ctx, field: FieldExprs, value: unknown): string {
  void ctx;
  return typeof value === "number" ? field.num : field.expr;
}

/** Compile a filter object (fields + logical operators) into a WHERE fragment. */
export function compileFilter(
  filter: FilterObject | undefined,
  flavor: SqlFlavor,
  base = 0,
): CompiledWhere {
  const ctx: Ctx = { flavor, params: [], base };
  const where = compileNode(ctx, filter ?? {});
  return { sql: where || "1 = 1", params: ctx.params };
}

function compileNode(ctx: Ctx, node: FilterObject): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    switch (key) {
      case "$and": {
        const branches = asArray(value).map((branch) =>
          compileNode(ctx, branch as FilterObject),
        );
        parts.push(
          branches.length === 0
            ? "1 = 1"
            : branches.length === 1
              ? branches[0]!
              : branches.map((b) => `(${b})`).join(" AND "),
        );
        break;
      }
      case "$or": {
        const branches = asArray(value).map((branch) =>
          compileNode(ctx, branch as FilterObject),
        );
        parts.push(
          branches.length === 0
            ? "0 = 1"
            : branches.length === 1
              ? `(${branches[0]!})`
              : `(${branches.map((b) => `(${b})`).join(" OR ")})`,
        );
        break;
      }
      case "$nor": {
        // Mongo semantics: matches when NONE of the branch expressions match
        // (an empty $nor matches everything).
        const branches = asArray(value).map((branch) =>
          compileNode(ctx, branch as FilterObject),
        );
        parts.push(
          branches.length === 0
            ? "1 = 1"
            : `NOT (${branches.map((b) => `(${b})`).join(" OR ")})`,
        );
        break;
      }
      case "$not": {
        const inner = compileNode(ctx, value as FilterObject);
        parts.push(`NOT (${inner})`);
        break;
      }
      default: {
        const field = fieldExprs(ctx.flavor, key.split("."));
        if (isOperatorObject(value)) {
          parts.push(compileOperators(ctx, field, value));
        } else {
          parts.push(equalityPredicate(ctx, field, value));
        }
      }
    }
  }
  return andGroup(parts);
}

function isOperatorObject(value: unknown): value is FilterObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.keys(value).length > 0 && Object.keys(value).every((k) => k.startsWith("$"));
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("$and/$or expect an array");
  return value;
}

export interface CompiledSort {
  sql: string;
}

/**
 * Compile a sort object (`{ name: 1, _localme.updated: -1 }`) into ORDER BY.
 *
 * `_localme.created` / `_localme.updated` are the one thing that look like
 * document paths but are not: they are synthesised from the `created_at` and
 * `updated_at` columns when a row is read, so a JSON path over `document` can
 * never find them. Ordering by the columns directly is also the only way the
 * ordering is stable across a pagination window — sorting client-side would
 * sort one page at a time.
 */
export function compileSort(sort: FilterObject | undefined, flavor: SqlFlavor): CompiledSort {
  if (!sort || Object.keys(sort).length === 0) return { sql: "" };
  const entries = Object.entries(sort).slice(0, 8);
  const parts = entries.map(([key, dir]) => {
    const direction = dir === -1 || dir === "-1" ? "DESC" : "ASC";
    const meta = key === "_localme.created" || key === "created_at"
      ? "created_at"
      : key === "_localme.updated" || key === "updated_at"
        ? "updated_at"
        : null;
    if (meta) return `${meta} ${direction}`;

    const segments = key.split(".");
    const quoted = segments.map((seg) => `'${seg.replace(/'/g, "''")}'`).join("->");
    const text = jsonPathText(flavor, segments);
    // Numbers must order numerically (as text, "90" > "140"); non-numeric
    // values coerce to 0 on the numeric key and tie-break on the text form.
    const numeric =
      flavor === "postgres"
        ? `CASE WHEN jsonb_typeof(document->${quoted}) = 'number' THEN ((document->${quoted}) #>> '{}')::numeric END`
        : `CAST(${text} AS REAL)`;
    return `${numeric} ${direction}, ${text} ${direction}`;
  });
  return { sql: ` ORDER BY ${parts.join(", ")}` };
}

export type UpdateSpec = { [key: string]: unknown };

export interface CompiledUpdate {
  assignments: string[];
  params: unknown[];
}

/**
 * Compile an update into per-row JSON patching. Postgres uses jsonb
 * concatenation (`document || patch`); SQLite uses json_patch. $inc and $unset
 * chain on top of the patch expression; each op renumbers its own placeholder,
 * so the SQL stays valid regardless of how many operations compose.
 */
/**
 * Compile an update into per-row JSON patching. Postgres uses jsonb
 * concatenation (`document || patch`); SQLite uses json_patch. $inc and $unset
 * chain on top of the patch expression; each op renumbers its own placeholder,
 * so the SQL stays valid regardless of how many operations compose.
 */
export function compileUpdate(update: UpdateSpec, flavor: SqlFlavor, base = 0): CompiledUpdate {
  const params: unknown[] = [];
  const setOps: Array<[string, unknown]> = [];
  const incOps: Array<[string, number]> = [];
  const unsetKeys: string[] = [];

  for (const [key, value] of Object.entries(update)) {
    if (key === "$set") {
      for (const [k, v] of Object.entries(value as FilterObject)) {
        setOps.push([k, v] as [string, unknown]);
      }
    } else if (key === "$inc") {
      for (const [k, v] of Object.entries(value as FilterObject)) {
        if (typeof v !== "number") throw new Error("$inc expects numeric values");
        incOps.push([k, v] as [string, number]);
      }
    } else if (key === "$unset") {
      for (const k of Object.keys(value as FilterObject)) unsetKeys.push(k);
    } else if (key.startsWith("$")) {
      throw new Error(`Unsupported update operator "${key}"`);
    } else {
      setOps.push([key, value] as [string, unknown]);
    }
  }

  const cleanKey = (k: string) => k.replace(/'/g, "''");
  let expr = "document";
  let changed = false;

  if (setOps.length > 0) {
    const patchJson = JSON.stringify(Object.fromEntries(setOps));
    params.push(patchJson);
    const patchParam = placeholder(flavor, base + params.length - 1);
    expr =
      flavor === "postgres"
        ? `document || ${patchParam}::jsonb`
        : `json_patch(document, ${patchParam})`;
    changed = true;
  }
  for (const [k, v] of incOps) {
    params.push(JSON.stringify({ [k]: v }));
    const incParam = placeholder(flavor, base + params.length - 1);
    const key = cleanKey(k);
    const current = jsonPathExpr(flavor, [k]);
    expr =
      flavor === "postgres"
        ? `jsonb_set(${expr}, ARRAY['${key}'], to_jsonb(COALESCE(((${current}) #>> '{}')::numeric, 0) + (((${incParam}::jsonb) -> '${key}') #>> '{}')::numeric))`
        : `json_set(${expr}, '$.${key}', COALESCE(json_extract(${expr}, '$.${key}'), 0) + json_extract(${incParam}, '$.${key}'))`;
    changed = true;
  }
  for (const k of unsetKeys) {
    const key = cleanKey(k);
    expr =
      flavor === "postgres"
        ? `(${expr}) - '${key}'`
        : `json_remove(${expr}, '$.${key}')`;
    changed = true;
  }
  if (!changed) {
    throw new Error("Empty update");
  }
  return {
    assignments: [`document = ${expr}`, `updated_at = CURRENT_TIMESTAMP`],
    params,
  };
}

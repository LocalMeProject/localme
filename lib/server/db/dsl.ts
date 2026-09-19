/**
 * MongoDB-style query DSL → parameterized SQL, compiled per dialect.
 *
 * Operates on the project_data document store (Blueprint §4.2): `table`,
 * `document` (JSON), `project_id`. Supported operators: $eq, $ne, $gt, $gte,
 * $lt, $lte, $in, $nin, $regex, $exists, $and, $or, $not (Blueprint §4.2).
 * Both dialects share one AST (compileFilter); only leaf predicate SQL and the
 * parameter placeholder differ.
 */
import type { SqlFlavor } from "./sql";
import { jsonPathExpr, jsonPathText, placeholder } from "./sql";

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
}

function addParam(ctx: Ctx, value: unknown): string {
  ctx.params.push(value === undefined ? null : value);
  return placeholder(ctx.flavor, ctx.params.length - 1);
}

function numberExpr(ctx: Ctx, expr: string): string {
  return ctx.flavor === "postgres"
    ? `(CASE WHEN jsonb_typeof(${expr}) = 'number' THEN (${expr})#>>'{}' ELSE NULL END)::numeric`
    : `CAST(${expr} AS REAL)`;
}

/** Cast a JSON scalar to the SQL type used for comparisons. */
function scalarExpr(ctx: Ctx, expr: string): string {
  return ctx.flavor === "postgres" ? `${expr}#>>'{}'` : expr;
}

function andGroup(parts: string[]): string {
  return parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(" AND ");
}

/** Compile an operator object (`{ $gt: 18 }`) against a JSON path. */
function compileOperators(ctx: Ctx, fieldExpr: string, ops: FilterObject): string {
  const parts: string[] = [];
  for (const [op, value] of Object.entries(ops)) {
    switch (op) {
      case "$eq": {
        if (typeof value === "number") {
          parts.push(`(${numberExpr(ctx, fieldExpr)} = ${addParam(ctx, value)})`);
        } else {
          parts.push(`(${scalarExpr(ctx, fieldExpr)} = ${addParam(ctx, value)})`);
        }
        break;
      }
      case "$ne": {
        const eq =
          typeof value === "number"
            ? `(${numberExpr(ctx, fieldExpr)} = ${addParam(ctx, value)})`
            : `(${scalarExpr(ctx, fieldExpr)} = ${addParam(ctx, value)})`;
        parts.push(`NOT ${eq}`);
        break;
      }
      case "$gt":
      case "$gte":
      case "$lt":
      case "$lte": {
        const sqlOp = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op]!;
        const left =
          typeof value === "number" ? numberExpr(ctx, fieldExpr) : scalarExpr(ctx, fieldExpr);
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
        const left = hasNumbers ? numberExpr(ctx, fieldExpr) : scalarExpr(ctx, fieldExpr);
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
        const flavor = ctx.flavor;
        const textExpr = scalarExpr(ctx, fieldExpr);
        if (flavor === "postgres") {
          parts.push(`(${textExpr} ~ ${addParam(ctx, value)})`);
        } else {
          const escaped = value.replace(/'/g, "''");
          parts.push(
            `(COALESCE(${textExpr}, '') REGEXP ${addParam(ctx, escaped)})`,
          );
        }
        break;
      }
      case "$exists": {
        const exists =
          ctx.flavor === "postgres"
            ? `${fieldExpr} IS NOT NULL`
            : `${fieldExpr} IS NOT NULL AND json_extract_type_check(${fieldExpr}) IS NULL`;
        parts.push(value === true ? `(${exists})` : `NOT (${exists})`);
        break;
      }
      default:
        throw new Error(`Unsupported operator "${op}"`);
    }
  }
  return andGroup(parts);
}

/** Compile a filter object (fields + logical operators) into a WHERE fragment. */
export function compileFilter(filter: FilterObject | undefined, flavor: SqlFlavor): CompiledWhere {
  const ctx: Ctx = { flavor, params: [] };
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
              ? branches[0]!
              : branches.map((b) => `(${b})`).join(" OR "),
        );
        break;
      }
      case "$not": {
        const inner = compileNode(ctx, value as FilterObject);
        parts.push(`NOT (${inner})`);
        break;
      }
      default: {
        const segments = key.split(".");
        const expr = jsonPathExpr(ctx.flavor, segments);
        if (isOperatorObject(value)) {
          parts.push(compileOperators(ctx, expr, value));
        } else if (value === null) {
          parts.push(`(${scalarExpr(ctx, expr)} IS NULL)`);
        } else if (typeof value === "number") {
          parts.push(`(${numberExpr(ctx, expr)} = ${addParam(ctx, value)})`);
        } else if (typeof value === "boolean") {
          // Booleans are compared textually: JSON true → "true".
          parts.push(
            `(LOWER(COALESCE(${scalarExpr(ctx, expr)}, '')) = ${addParam(ctx, value ? "true" : "false")})`,
          );
        } else if (typeof value === "object") {
          // Arrays/objects compare on their canonical JSON text.
          parts.push(`(${scalarExpr(ctx, expr)} = ${addParam(ctx, JSON.stringify(value))})`);
        } else {
          parts.push(`(${scalarExpr(ctx, expr)} = ${addParam(ctx, value)})`);
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

/** Compile a sort object (`{ name: 1, created: -1 }`) into ORDER BY. */
export function compileSort(sort: FilterObject | undefined, flavor: SqlFlavor): CompiledSort {
  if (!sort || Object.keys(sort).length === 0) return { sql: "" };
  const entries = Object.entries(sort).slice(0, 8);
  const parts = entries.map(([key, dir]) => {
    const expr = jsonPathText(flavor, key.split("."));
    return `${expr} ${dir === -1 || dir === "-1" ? "DESC" : "ASC"}`;
  });
  return { sql: ` ORDER BY ${parts.join(", ")}` };
}

export type UpdateSpec = { [key: string]: unknown };

export interface CompiledUpdate {
  assignments: string[];
  params: unknown[];
}

/**
 * Compile an update into per-row JSON patching. Postgres uses jsonb concatenation;
 * SQLite uses json_patch. $inc/$unset are applied by rewriting the document.
 */
export function compileUpdate(update: UpdateSpec, flavor: SqlFlavor): CompiledUpdate {
  const params: unknown[] = [];
  const setOps: string[] = [];
  const incOps: string[] = [];
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

  const assignments: string[] = [];
  const docExpr = flavor === "postgres" ? "document" : "document";

  let expr = docExpr;
  if (setOps.length > 0) {
    const patchJson = JSON.stringify(Object.fromEntries(setOps.map(([k, v]) => [k, v])));
    params.push(patchJson);
    const patchParam = placeholder(flavor, params.length - 1);
    expr =
      flavor === "postgres"
        ? `document || ${patchParam}::jsonb`
        : `json_patch(document, ${patchParam})`;
  }
  for (const [k, v] of incOps) {
    params.push(JSON.stringify({ [k]: v }));
    const incParam = placeholder(flavor, params.length - 1);
    const pathExpr =
      flavor === "postgres"
        ? `COALESCE(document->'${k.replace(/'/g, "''")}', '0')::numeric + ((${incParam}::jsonb)->>'${k.replace(/'/g, "''")}')::numeric`
        : `COALESCE(json_extract(document, '$.${k.replace(/'/g, "''")}'), 0) + json_extract(${incParam}, '$.${k.replace(/'/g, "''")}')`;
    expr =
      flavor === "postgres"
        ? `jsonb_set(document, ARRAY['${k.replace(/'/g, "''")}'], to_jsonb(${pathExpr}))`
        : `json_set(document, '$.${k.replace(/'/g, "''")}', ${pathExpr})`;
  }
  for (const k of unsetKeys) {
    const clean = k.replace(/'/g, "''");
    expr =
      flavor === "postgres"
        ? `document - '${clean}'`
        : `json_remove(document, '$.${clean}')`;
  }
  if (expr === docExpr) {
    throw new Error("Empty update");
  }
  assignments.push(`document = ${expr}`);
  assignments.push(`updated_at = CURRENT_TIMESTAMP`);
  return { assignments, params };
}

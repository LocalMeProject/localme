import { fail } from "./errors";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonDocument = Record<string, unknown>;

/** The specification caps every query at 500 documents (P-27). */
export const MAX_QUERY_RESULTS = 500;
/** Upper bound on documents scanned per query so the work stays bounded. */
export const MAX_SCAN = 5000;

export const SUPPORTED_OPERATORS = [
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$regex",
  "$exists",
  "$and",
  "$or",
  "$not",
] as const;

function resolveField(document: JsonDocument, path: string): unknown {
  if (path in document) return document[path];
  const segments = path.split(".");
  let current: unknown = document;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function comparable(value: unknown): number | string | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return null;
  return null;
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "string") return String(a) === b;
  if (typeof a === "string" && typeof b === "number") return a === String(b);
  if (a instanceof Date && typeof b === "string") return a.toISOString() === b;
  return false;
}

function compareValues(a: unknown, b: unknown): number | null {
  const left = comparable(a);
  const right = comparable(b);
  if (left === null || right === null) return null;
  if (typeof left === "number" && typeof right === "number") return left === right ? 0 : left < right ? -1 : 1;
  const leftString = String(left);
  const rightString = String(right);
  return leftString === rightString ? 0 : leftString < rightString ? -1 : 1;
}

function evaluateOperator(operator: string, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case "$eq":
      return looseEquals(actual, expected);
    case "$ne":
      return !looseEquals(actual, expected);
    case "$gt": {
      const result = compareValues(actual, expected);
      return result !== null && result > 0;
    }
    case "$gte": {
      const result = compareValues(actual, expected);
      return result !== null && result >= 0;
    }
    case "$lt": {
      const result = compareValues(actual, expected);
      return result !== null && result < 0;
    }
    case "$lte": {
      const result = compareValues(actual, expected);
      return result !== null && result <= 0;
    }
    case "$in":
      return Array.isArray(expected) && expected.some((candidate) => looseEquals(actual, candidate));
    case "$nin":
      return Array.isArray(expected) && !expected.some((candidate) => looseEquals(actual, candidate));
    case "$regex": {
      if (typeof expected !== "string") return false;
      const options = (expected.match(/^\/.*\/([a-z]*)$/) ?? [])[1] ?? "";
      const pattern = expected.startsWith("/") ? expected.slice(1, expected.lastIndexOf("/")) : expected;
      try {
        return new RegExp(pattern, options).test(typeof actual === "string" ? actual : JSON.stringify(actual ?? ""));
      } catch {
        fail(`Invalid regular expression: ${expected}`, 400, "invalid_filter");
      }
      return false;
    }
    case "$exists":
      return expected ? actual !== undefined : actual === undefined;
    default:
      fail(`Unsupported filter operator: ${operator}`, 400, "invalid_filter");
  }
}

/**
 * Evaluates a MongoDB-style filter against a document.
 * Supported: implicit equality, `$eq $ne $gt $gte $lt $lte $in $nin $regex
 * $exists $and $or $not`, dotted paths and field-level operator objects.
 */
export function matchesFilter(document: JsonDocument, filter: unknown): boolean {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) return true;
  const entries = Object.entries(filter as Record<string, unknown>);

  if ("$and" in (filter as Record<string, unknown>)) {
    const clauses = (filter as Record<string, unknown>).$and;
    if (!Array.isArray(clauses) || !clauses.every((clause) => matchesFilter(document, clause))) return false;
  }
  if ("$or" in (filter as Record<string, unknown>)) {
    const clauses = (filter as Record<string, unknown>).$or;
    if (!Array.isArray(clauses) || !clauses.some((clause) => matchesFilter(document, clause))) return false;
  }
  if ("$not" in (filter as Record<string, unknown>)) {
    if (matchesFilter(document, (filter as Record<string, unknown>).$not)) return false;
  }

  for (const [key, condition] of entries) {
    if (key.startsWith("$")) continue;
    const actual = resolveField(document, key);
    if (condition !== null && typeof condition === "object" && !Array.isArray(condition)) {
      for (const [operator, expected] of Object.entries(condition as Record<string, unknown>)) {
        if (!operator.startsWith("$")) {
          // Nested object filter — treat as a sub-document match.
          if (!matchesFilter((actual ?? {}) as JsonDocument, condition)) return false;
          continue;
        }
        if (!evaluateOperator(operator, actual, expected)) return false;
      }
      continue;
    }
    if (!looseEquals(actual, condition)) return false;
  }
  return true;
}

/** Sorts documents by a `{ field: 1 | -1 }` specification. */
export function sortDocuments<T extends JsonDocument>(documents: T[], sort: unknown): T[] {
  if (!sort || typeof sort !== "object" || Array.isArray(sort)) return documents;
  const spec = Object.entries(sort as Record<string, unknown>);
  if (spec.length === 0) return documents;
  return [...documents].sort((a, b) => {
    for (const [field, direction] of spec) {
      const result = compareValues(resolveField(a, field), resolveField(b, field));
      if (result === null || result === 0) continue;
      return Number(direction) < 0 ? -result : result;
    }
    return 0;
  });
}

/** `$set` / `$inc` / `$unset` update documents, with plain-merge fallback. */
export function applyUpdate(document: JsonDocument, update: unknown): JsonDocument {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    fail("Update payload must be an object", 400, "invalid_update");
  }
  const payload = update as Record<string, unknown>;
  const hasOperators = Object.keys(payload).some((key) => key.startsWith("$"));
  if (!hasOperators) return { ...document, ...payload };

  const next: JsonDocument = { ...document };
  for (const [key, value] of Object.entries(payload)) {
    if (key === "$set" && value && typeof value === "object") {
      Object.assign(next, value as JsonDocument);
    } else if (key === "$inc" && value && typeof value === "object") {
      for (const [field, delta] of Object.entries(value as Record<string, unknown>)) {
        const current = next[field];
        next[field] = (typeof current === "number" ? current : 0) + Number(delta);
      }
    } else if (key === "$unset" && value && typeof value === "object") {
      for (const field of Object.keys(value as Record<string, unknown>)) delete next[field];
    } else if (!key.startsWith("$")) {
      next[key] = value;
    }
  }
  return next;
}

/** Every document must carry a non-null, unique `id` field (P-7). */
export function documentIdOf(document: JsonDocument): string {
  const id = document.id;
  if (id === undefined || id === null) {
    fail("Every document must contain a non-null `id` field", 400, "missing_document_id");
  }
  if (typeof id !== "string" && typeof id !== "number") {
    fail("The `id` field must be a string or a number", 400, "invalid_document_id");
  }
  const value = String(id);
  if (value.length === 0 || value.length > 200) {
    fail("The `id` field must be between 1 and 200 characters", 400, "invalid_document_id");
  }
  return value;
}

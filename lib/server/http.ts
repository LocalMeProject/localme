/**
 * HTTP plumbing shared by every route handler: JSON responses with the
 * documented `{ error, code }` body, zod body parsing, and the per-request rate
 * limit every route inherits (Blueprint §7, §5.11).
 *
 * The error vocabulary lives in `./errors` and is re-exported here; see the note
 * in that file for why it is not defined inline.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, statusForCode, STATUS_BY_CODE, type ApiErrorCode } from "@/lib/server/errors";
import { enforceRateLimit, rateGroupFor } from "@/lib/server/ratelimit";
import { createLogger } from "@/lib/server/logger";

export { ApiError, statusForCode, type ApiErrorCode };

/** Uniform error body: `{ error, code }` per the docs "Errors" section. */
export function apiError(code: ApiErrorCode, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status: STATUS_BY_CODE[code], headers },
  );
}

/** 429 carries `Retry-After` per the docs rate-limit section. */
export function apiRateLimited(retryAfterSeconds: number): NextResponse {
  return apiError("rate_limited", "Rate limit exceeded, slow down.", {
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
  });
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** Parse + validate a JSON body against a zod schema. */
/** Parse a JSON body against a zod schema; throws ApiError(bad_request) on failure. */
export async function parseJson<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("bad_request", "Body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first ? ` at "${first.path.join(".")}"` : "";
    throw new ApiError("bad_request", `Invalid body${where}: ${first?.message ?? "validation failed"}`);
  }
  return result.data;
}

/** Route-handler wrapper: converts thrown ApiErrors into documented responses. */
export type RouteContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

/** API request logging (§9.4) — every unhandled fault lands here. */
const log = createLogger("api");

export function handler<P extends Record<string, string> = Record<string, string>>(
  fn: (request: Request, context: RouteContext<P>) => Promise<NextResponse>,
) {
  return async (request: Request, context?: RouteContext<P>): Promise<NextResponse> => {
    const path = new URL(request.url).pathname;
    try {
      // §5.11 rate limiting is applied here rather than per route, so a new
      // endpoint cannot ship unprotected by omission. `rateGroupFor` maps the
      // path to its documented budget.
      const limited = await enforceRateLimit(request, rateGroupFor(path));
      if (limited) return limited;
      return await fn(request, context ?? { params: Promise.resolve({} as P) });
    } catch (error) {
      if (error instanceof ApiError) {
        // 4xx are the caller's problem and expected in normal traffic; only
        // server faults and rate limits are worth a log line (§9.4).
        if (error.code === "rate_limited") {
          log.warn("rate_limited", { method: request.method, path });
        }
        return apiError(error.code, error.message, error.headers);
      }
      log.error("unhandled_error", {
        method: request.method,
        path,
        error,
      });
      return apiError("internal_error", "Something went wrong.");
    }
  };
}
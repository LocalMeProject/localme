/**
 * HTTP plumbing shared by every route handler: JSON responses with the
 * documented `{ error, code }` body, zod body parsing, and the principal
 * resolution used to authenticate a request (Blueprint §7, the `/docs` auth
 * section).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "payload_too_large"
  | "payment_required"
  | "rate_limited"
  | "bad_gateway"
  | "gateway_timeout"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  payload_too_large: 413,
  payment_required: 402,
  rate_limited: 429,
  bad_gateway: 502,
  gateway_timeout: 504,
  internal_error: 500,
};

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

export function handler<P extends Record<string, string> = Record<string, string>>(
  fn: (request: Request, context: RouteContext<P>) => Promise<NextResponse>,
) {
  return async (request: Request, context?: RouteContext<P>): Promise<NextResponse> => {
    try {
      return await fn(request, context ?? { params: Promise.resolve({} as P) });
    } catch (error) {
      if (error instanceof ApiError) {
        return apiError(error.code, error.message);
      }
      console.error("[api] unhandled error:", error);
      return apiError("internal_error", "Something went wrong.");
    }
  };
}

/** Throwable error carrying a documented status/code pair. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The platform's error vocabulary (Blueprint §15).
 *
 * This module has no imports on purpose: `http.ts` builds responses from it and
 * `ratelimit.ts` throws it, so keeping it dependency-free is what stops the
 * request pipeline from forming a cycle the moment rate limiting moves into the
 * shared handler. `http.ts` re-exports everything here, so the ~20 modules that
 * already import `ApiError` from `@/lib/server/http` keep working unchanged.
 */

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
  | "service_unavailable"
  | "internal_error";

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
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
  // A missing SESSION_SECRET takes encryption offline. That is the server's
  // problem, not the caller's bad request, so it must not be a 400 or a 500.
  service_unavailable: 503,
  internal_error: 500,
};

/** HTTP status for an error code — shared by API handlers and project serving. */
export function statusForCode(code: ApiErrorCode): number {
  return STATUS_BY_CODE[code];
}

/**
 * Throwable error carrying a documented status/code pair, plus any headers the
 * response must carry (`Retry-After` on a 429 is the documented case).
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

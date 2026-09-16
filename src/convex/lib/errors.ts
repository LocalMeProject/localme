/**
 * Platform exception, mirroring the `LocalMeException` type from the
 * specification: a message plus the HTTP status code the API layer must emit.
 *
 * Convex rebuilds errors as they cross function boundaries, so the status and
 * code are also embedded in the message as a `[localme:status:code]` marker.
 * The HTTP layer reads them back with {@link errorStatus} / {@link errorCode}.
 */
export const ERROR_MARKER = /\[localme:(\d{3}):([a-z_]+)\]\s*/;

export function markerFor(statusCode: number, code: string): string {
  return `[localme:${statusCode}:${code}] `;
}

export class LocalMeError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "bad_request") {
    super(`${markerFor(statusCode, code)}${message}`);
    this.name = "LocalMeError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function fail(message: string, statusCode = 400, code = "bad_request"): never {
  throw new LocalMeError(message, statusCode, code);
}

function rawText(error: unknown): string {
  if (error instanceof LocalMeError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function errorMessage(error: unknown): string {
  const text = rawText(error);
  const marker = ERROR_MARKER.exec(text);
  if (!marker) return text;
  // Drop the marker, Convex's `Uncaught …` prefix and any appended stack frames.
  return text
    .slice(marker.index + marker[0].length)
    .split("\n    at ")[0]
    .trim();
}

export function errorStatus(error: unknown): number {
  const marker = ERROR_MARKER.exec(rawText(error));
  if (marker) return Number(marker[1]);
  return error instanceof LocalMeError ? error.statusCode : 500;
}

export function errorCode(error: unknown): string {
  const marker = ERROR_MARKER.exec(rawText(error));
  if (marker) return marker[2];
  return error instanceof LocalMeError ? error.code : "internal_error";
}

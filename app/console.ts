/**
 * Console client helpers: every page talks to the platform API with session
 * cookies and the documented `{ error, code }` error body.
 *
 * Formatting deliberately does *not* live here. Byte counts and dates are
 * culture-dependent — "5 MB" is "۵ مگابایت" in `fa-IR` and a Shamsi date is
 * not a reformat of a Gregorian one — so they come from `useI18n().fmt`,
 * which is bound to the active culture and to editable wording.
 */
"use client";

export class ConsoleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ConsoleError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (proxy 502s, empty responses).
  }
  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; code?: string };
    throw new ConsoleError(body.error ?? `Request failed (${response.status})`, body.code ?? "error", response.status);
  }
  return payload as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return api<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

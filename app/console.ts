/**
 * Console client helpers: every page talks to the platform API with session
 * cookies and the documented `{ error, code }` error body.
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

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * Centralized API client wrapper with automatic authorization header injection,
 * JSON serialization, and 401 session expiration interception.
 */

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
}

export async function apiFetch<T = any>(
  input: string | URL,
  init?: RequestInit
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('localme_token') : null;
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('localme_token');
      localStorage.removeItem('localme_user');
      const currentPath = window.location.pathname + window.location.search;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/auth')) {
        window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
      }
    }
    throw new Error('UNAUTHORIZED: نشست کاربری شما به پایان رسیده است.');
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errJson.message || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export const api = {
  get: <T = any>(url: string, headers?: HeadersInit) =>
    apiFetch<T>(url, { method: 'GET', headers }),

  post: <T = any>(url: string, body?: any, headers?: HeadersInit) =>
    apiFetch<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T = any>(url: string, body?: any, headers?: HeadersInit) =>
    apiFetch<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  delete: <T = any>(url: string, headers?: HeadersInit) =>
    apiFetch<T>(url, { method: 'DELETE', headers }),
};

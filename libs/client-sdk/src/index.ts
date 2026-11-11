/**
 * LocalMe Sovereign Client SDK for Web and Mobile
 * Pure .NET 10 + PostgreSQL 18.1 Wire Contract
 * Exposes core namespaces: localme.auth, localme.from(), localme.functions, localme.database
 */

export * from './types';
import type {
  LocalMeConfig,
  FunctionInvokeResult,
  FunctionMeta,
  AuthSignUpOptions,
  AuthSignInOptions,
  AuthResult,
} from './types';
export * from './query-builder';
import { TableQueryBuilder } from './query-builder';

export class LocalMeClient {
  public readonly projectSlug: string;
  public readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: LocalMeConfig) {
    this.projectSlug = config.projectSlug;
    this.baseUrl = config.baseUrl || `https://${config.projectSlug}.localme.ir`;
    this.apiKey = config.apiKey;
  }

  /**
   * Helper headers factory
   */
  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra || {}),
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * PostgREST AST Dynamic SQL Query Builder.
   * Enables fluent chained queries: client.from('users').select('*').eq('status', 'active').execute()
   */
  public from<T = Record<string, unknown>>(table: string): TableQueryBuilder<T> {
    return new TableQueryBuilder<T>(
      this.baseUrl,
      this.projectSlug,
      table,
      this.getHeaders()
    );
  }

  /**
   * Edge Functions Invoker & Manager (Jint Sandboxed Execution).
   */
  public get functions() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();

    return {
      async list(): Promise<FunctionMeta[]> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions`, { headers });
        if (!res.ok) throw new Error(`List functions failed: ${res.status}`);
        return (await res.json()) as FunctionMeta[];
      },

      async get(slug: string): Promise<FunctionMeta> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions/${slug}`, { headers });
        if (!res.ok) throw new Error(`Get function failed: ${res.status}`);
        return (await res.json()) as FunctionMeta;
      },

      async deploy(name: string, script: string, slug?: string): Promise<FunctionMeta> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, script, slug }),
        });
        if (!res.ok) throw new Error(`Deploy function failed: ${res.status}`);
        return (await res.json()) as FunctionMeta;
      },

      async update(slug: string, name?: string, script?: string): Promise<FunctionMeta> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions/${slug}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name, script }),
        });
        if (!res.ok) throw new Error(`Update function failed: ${res.status}`);
        return (await res.json()) as FunctionMeta;
      },

      async delete(slug: string): Promise<{ success: boolean }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions/${slug}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) throw new Error(`Delete function failed: ${res.status}`);
        return (await res.json()) as { success: boolean };
      },

      async invoke<T = unknown>(slug: string, payload?: unknown): Promise<FunctionInvokeResult<T>> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions/${slug}/invoke`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload ?? {}),
        });
        if (!res.ok) throw new Error(`Function invocation failed: ${res.status}`);
        return (await res.json()) as FunctionInvokeResult<T>;
      },
    };
  }

  /**
   * Project End-User Auth Service (Argon2id Email/Password, Ed25519 JWT, User CRUD).
   */
  public get auth() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();

    return {
      async signUp(options: AuthSignUpOptions): Promise<AuthResult> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: options.username,
            email: options.email,
            phone: options.phone,
            password: options.password,
            full_name: options.fullName,
          }),
        });
        if (!res.ok) throw new Error(`Sign up failed: ${res.status}`);
        return (await res.json()) as AuthResult;
      },

      async signInWithPassword(options: AuthSignInOptions): Promise<AuthResult> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: options.login,
            password: options.password,
          }),
        });
        if (!res.ok) throw new Error(`Password login failed: ${res.status}`);
        return (await res.json()) as AuthResult;
      },

      async refreshToken(refreshToken: string): Promise<AuthResult> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) throw new Error(`Refresh token failed: ${res.status}`);
        return (await res.json()) as AuthResult;
      },

      async signOut(refreshToken?: string): Promise<{ success: boolean }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/logout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return { success: false };
        return (await res.json()) as { success: boolean };
      },

      async getJwks(): Promise<Record<string, unknown>> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/jwks`);
        if (!res.ok) throw new Error(`Fetch JWKS failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>;
      },

      async getUsers(): Promise<Record<string, unknown>[]> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/users`, { headers });
        if (!res.ok) throw new Error(`List users failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>[];
      },

      async deleteUser(userId: string): Promise<{ success: boolean }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/users/${userId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) throw new Error(`Delete user failed: ${res.status}`);
        return (await res.json()) as { success: boolean };
      },

      async updateUserStatus(userId: string, isConfirmed: boolean): Promise<{ success: boolean; user: Record<string, unknown> }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/users/${userId}/status`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ is_confirmed: isConfirmed }),
        });
        if (!res.ok) throw new Error(`Update user status failed: ${res.status}`);
        return (await res.json()) as { success: boolean; user: Record<string, unknown> };
      },

      async resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; user: Record<string, unknown> }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/users/${userId}/reset-password`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ password: newPassword }),
        });
        if (!res.ok) throw new Error(`Reset password failed: ${res.status}`);
        return (await res.json()) as { success: boolean; user: Record<string, unknown> };
      },

      async getPolicies(): Promise<Record<string, unknown>> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/policies`, { headers });
        if (!res.ok) throw new Error(`Get policies failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>;
      },

      async updatePolicies(policies: Record<string, string>): Promise<{ success: boolean; config: unknown }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/policies`, {
          method: 'POST',
          headers,
          body: JSON.stringify(policies),
        });
        if (!res.ok) throw new Error(`Update policies failed: ${res.status}`);
        return (await res.json()) as { success: boolean; config: unknown };
      },
    };
  }

  /**
   * Telemetry & Project Logs Service (PostgreSQL Partitioned Logs & Slow Queries).
   */
  public get telemetry() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();

    return {
      async getLogs(options?: { service?: string; level?: string; limit?: number }): Promise<Record<string, unknown>[]> {
        const params = new URLSearchParams();
        if (options?.service) params.set('service', options.service);
        if (options?.level) params.set('level', options.level);
        if (options?.limit) params.set('limit', String(options.limit));
        const q = params.toString() ? `?${params.toString()}` : '';

        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/logs${q}`, { headers });
        if (!res.ok) throw new Error(`Fetch logs failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>[];
      },

      async log(service: string, level: 'INFO' | 'WARN' | 'ERROR', message: string, traceId?: string): Promise<Record<string, unknown>> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ service, level, message, trace_id: traceId }),
        });
        if (!res.ok) throw new Error(`Emit log failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>;
      },
    };
  }
}

/**
 * Convenience factory to create a LocalMeClient instance.
 */
export function createClient(config: LocalMeConfig): LocalMeClient {
  return new LocalMeClient(config);
}

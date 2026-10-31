/**
 * LocalMe Sovereign Client SDK for Web and Mobile
 * Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8 Wire Contract
 */

export * from './types';
import type {
  LocalMeConfig,
  AuthOtpResponse,
  IpgRequestOptions,
  IpgResponse,
  IpgVerifyOptions,
  IpgVerifyResponse,
  StorageFileMeta,
  StorageBucket,
  FunctionInvokeResult,
  FunctionMeta,
  CaptchaResponse,
  CaptchaVerifyResponse,
  AuthSignUpOptions,
  AuthSignInOptions,
  AuthResult,
  SqlExecutionResult,
  WalletBalance,
  PlatformConfig,
  PushDeviceRegistration,
  PushMessageRequest,
  IapValidationRequest,
  TableIndexDefinition,
  TableRelationshipDefinition,
  TablePolicyDefinition,
  TableColumnMeta,
  DatabaseSnapshotMeta,
} from './types';
export * from './query-builder';
export * from './database';
import { TableQueryBuilder } from './query-builder';
import { DatabaseClient } from './database';

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
   * Converts Iranian Rial (IRR) to readable Persian Toman presentation string.
   */
  public static toTomanString(amountIrr: number | bigint): string {
    const toman = Number(amountIrr) / 10;
    return `${toman.toLocaleString('fa-IR')} تومان`;
  }

  /**
   * Request mobile OTP dispatch via domestic SMS or messenger channel.
   */
  public async requestOtp(phone: string, channel: 'sms' | 'call' | 'bale' = 'sms'): Promise<AuthOtpResponse> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/auth/otp/request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ phone, channel }),
    });

    if (!res.ok) {
      throw new Error(`OTP request failed with status: ${res.status}`);
    }

    return (await res.json()) as AuthOtpResponse;
  }

  /**
   * Initiate Shaparak / Shetab online IPG payment flow.
   */
  public async requestIpg(options: IpgRequestOptions): Promise<IpgResponse> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/pay/initiate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        amountIrr: options.amountIrr,
        gateway: options.provider,
        callbackUrl: options.callbackDeepLink,
        customerPhone: options.customerPhone,
        description: options.description || 'SDK Client Payment',
        idempotencyKey: options.idempotencyKey,
      }),
    });

    if (!res.ok) {
      throw new Error(`IPG initiation failed with status: ${res.status}`);
    }

    const data = (await res.json()) as IpgResponse;
    return {
      ...data,
      transactionId: data.authorityToken,
      paymentUrl: data.redirectUrl,
    };
  }

  /**
   * Verify an IPG payment authority after callback from bank gateway.
   */
  public async verifyIpg(options: IpgVerifyOptions): Promise<IpgVerifyResponse> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/pay/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        authorityToken: options.authorityToken,
        authority: options.authorityToken,
        trackingCode: options.trackingCode,
        gateway: options.gateway,
        status: options.status || 'OK',
      }),
    });

    if (!res.ok) {
      throw new Error(`IPG verification failed with status: ${res.status}`);
    }

    return (await res.json()) as IpgVerifyResponse;
  }

  /**
   * Query developer or end-user Iranian Rial wallet balance.
   */
  public async getWalletBalance(phone: string): Promise<WalletBalance> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/wallet/${encodeURIComponent(phone)}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Query wallet failed with status: ${res.status}`);
    return (await res.json()) as WalletBalance;
  }

  /**
   * Inspect platform connectivity and regulatory flags.
   */
  public async getHealth(): Promise<{ status: string; platform?: string; role: string; timestamp: string }> {
    const res = await fetch(`${this.baseUrl}/healthz`);
    if (!res.ok) throw new Error(`Health probe failed: ${res.status}`);
    return (await res.json()) as { status: string; platform?: string; role: string; timestamp: string };
  }

  /**
   * Retrieve platform sovereign configuration and egress NAT.
   */
  public async getConfig(): Promise<PlatformConfig> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/config`);
    if (!res.ok) throw new Error(`Platform config failed: ${res.status}`);
    return (await res.json()) as PlatformConfig;
  }

  /**
   * PostgREST-style query builder for relational tenant database tables.
   */
  public from<T = Record<string, unknown>>(table: string): TableQueryBuilder<T> {
    return new TableQueryBuilder<T>(this.baseUrl, this.projectSlug, table, this.getHeaders());
  }

  /**
   * Direct Database & Schema Management API.
   */
  public get database(): DatabaseClient {
    return new DatabaseClient(this.baseUrl, this.projectSlug, this.getHeaders());
  }

  /**
   * Blob Storage Bucket API.
   */
  public get storage() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();
    const apiKey = this.apiKey;

    return {
      async listBuckets(): Promise<StorageBucket[]> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/storage/buckets`, { headers });
        if (!res.ok) throw new Error(`List buckets failed: ${res.status}`);
        return (await res.json()) as StorageBucket[];
      },

      async createBucket(name: string, isPublic = false): Promise<StorageBucket> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/storage/buckets`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, is_public: isPublic }),
        });
        if (!res.ok) throw new Error(`Create bucket failed: ${res.status}`);
        return (await res.json()) as StorageBucket;
      },

      async deleteBucket(bucket: string): Promise<{ success: boolean }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/storage/buckets/${bucket}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) throw new Error(`Delete bucket failed: ${res.status}`);
        return (await res.json()) as { success: boolean };
      },

      from(bucket: string) {
        return {
          async list(): Promise<StorageFileMeta[]> {
            const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/storage/${bucket}/files`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            });
            if (!res.ok) throw new Error(`List files failed: ${res.status}`);
            return (await res.json()) as StorageFileMeta[];
          },

          async upload(fileName: string, data: Blob | ArrayBuffer | string, contentType = 'application/octet-stream'): Promise<StorageFileMeta> {
            const formData = new FormData();
            const blob = typeof data === 'string'
              ? new Blob([data], { type: contentType })
              : data instanceof Blob
                ? data
                : new Blob([data], { type: contentType });
            formData.append('file', blob, fileName);

            const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/storage/${bucket}/upload`, {
              method: 'POST',
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
              body: formData,
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
            return (await res.json()) as StorageFileMeta;
          },

          async delete(fileName: string): Promise<{ success: boolean }> {
            const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/storage/${bucket}/${encodeURIComponent(fileName)}`, {
              method: 'DELETE',
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            });
            if (!res.ok) throw new Error(`Delete file failed: ${res.status}`);
            return (await res.json()) as { success: boolean };
          },

          getPublicUrl(fileName: string): string {
            return `${baseUrl}/_baas/v1/${projectSlug}/storage/${bucket}/${fileName}`;
          },
        };
      },
    };
  }

  /**
   * Edge Functions Invoker & Manager.
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
   * Project End-User Auth Service.
   */
  public get auth() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();

    return {
      async signInWithOtp(phone: string, channel: 'sms' | 'call' | 'bale' = 'sms'): Promise<AuthOtpResponse> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/otp/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, channel }),
        });
        if (!res.ok) throw new Error(`Sign in OTP failed: ${res.status}`);
        return (await res.json()) as AuthOtpResponse;
      },

      async verifyOtp(phone: string, code: string): Promise<AuthResult> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code }),
        });
        if (!res.ok) throw new Error(`Verify OTP failed: ${res.status}`);
        return (await res.json()) as AuthResult;
      },

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
            captcha_id: options.captchaId,
            captcha_code: options.captchaCode,
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
            captcha_id: options.captchaId,
            captcha_code: options.captchaCode,
          }),
        });
        if (!res.ok) throw new Error(`Password login failed: ${res.status}`);
        return (await res.json()) as AuthResult;
      },

      async getCaptcha(): Promise<CaptchaResponse> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/captcha`);
        if (!res.ok) throw new Error(`Get captcha failed: ${res.status}`);
        return (await res.json()) as CaptchaResponse;
      },

      async verifyCaptcha(captchaId: string, code: string): Promise<CaptchaVerifyResponse> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/captcha/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captcha_id: captchaId, code }),
        });
        if (!res.ok) throw new Error(`Verify captcha failed: ${res.status}`);
        return (await res.json()) as CaptchaVerifyResponse;
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

      async getSmsLogs(): Promise<Record<string, unknown>[]> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/sms-logs`, { headers });
        if (!res.ok) throw new Error(`Get SMS logs failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>[];
      },
    };
  }

  /**
   * Mobile Push Notifications & Device Registry.
   */
  public get push() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();
    const apiKey = this.apiKey;

    return {
      async registerDevice(options: PushDeviceRegistration) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/devices/register`, {
          method: 'POST',
          headers,
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Push register device failed: ${res.status}`);
        return await res.json();
      },

      async unregisterDevice(deviceId: string) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/devices/${deviceId}`, {
          method: 'DELETE',
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (!res.ok) throw new Error(`Push unregister device failed: ${res.status}`);
        return await res.json();
      },

      async getDevices(userId?: string, platform?: string) {
        const url = new URL(`${baseUrl}/_baas/v1/${projectSlug}/push/devices`);
        if (userId) url.searchParams.set('userId', userId);
        if (platform) url.searchParams.set('platform', platform);
        const res = await fetch(url.toString(), { headers });
        if (!res.ok) throw new Error(`Get push devices failed: ${res.status}`);
        return await res.json();
      },

      async send(options: PushMessageRequest) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Push send failed: ${res.status}`);
        return await res.json();
      },

      async getConfig() {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/config`, { headers });
        if (!res.ok) throw new Error(`Get push config failed: ${res.status}`);
        return await res.json();
      },

      async updateConfig(config: unknown) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/config`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error(`Update push config failed: ${res.status}`);
        return await res.json();
      },

      async getHistory() {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/history`, { headers });
        if (!res.ok) throw new Error(`Get push history failed: ${res.status}`);
        return await res.json();
      },
    };
  }

  /**
   * Mobile In-App Purchases (Cafe Bazaar & Myket IAB).
   */
  public get iap() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();
    const apiKey = this.apiKey;

    return {
      async verifyBazaar(options: IapValidationRequest) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/iap/verify/bazaar`, {
          method: 'POST',
          headers,
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Bazaar IAP verification failed: ${res.status}`);
        return await res.json();
      },

      async verifyMyket(options: IapValidationRequest) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/iap/verify/myket`, {
          method: 'POST',
          headers,
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Myket IAP verification failed: ${res.status}`);
        return await res.json();
      },

      async getPurchases(userId?: string, store?: string) {
        const url = new URL(`${baseUrl}/_baas/v1/${projectSlug}/iap/purchases`);
        if (userId) url.searchParams.set('userId', userId);
        if (store) url.searchParams.set('store', store);
        const res = await fetch(url.toString(), {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (!res.ok) throw new Error(`Get IAP purchases failed: ${res.status}`);
        return await res.json();
      },

      async getConfig() {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/iap/config`, { headers });
        if (!res.ok) throw new Error(`Get IAP config failed: ${res.status}`);
        return await res.json();
      },

      async updateConfig(config: unknown) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/iap/config`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(config),
        });
        if (!res.ok) throw new Error(`Update IAP config failed: ${res.status}`);
        return await res.json();
      },
    };
  }

  /**
   * Duplex Realtime Streaming Client (WebSocket) & Event Broadcast.
   */
  public get realtime() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const headers = this.getHeaders();

    return {
      subscribe<T = unknown>(table: string, onEvent: (event: T) => void): () => void {
        const wsUrl = baseUrl.replace(/^http/, 'ws') + `/_baas/v1/${projectSlug}/realtime`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws.send(JSON.stringify({ action: 'subscribe', table }));
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            onEvent(parsed);
          } catch {
            // Ignore non-json
          }
        };

        return () => {
          try {
            ws.send(JSON.stringify({ action: 'unsubscribe', table }));
            ws.close();
          } catch {
            // Socket already closed
          }
        };
      },

      async broadcast(table: string, action: string, data: unknown): Promise<{ success: boolean; message: string }> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/realtime/broadcast`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ table, action, data }),
        });
        if (!res.ok) throw new Error(`Broadcast failed: ${res.status}`);
        return (await res.json()) as { success: boolean; message: string };
      },
    };
  }
}

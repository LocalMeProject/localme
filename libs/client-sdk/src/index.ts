/**
 * LocalMe Sovereign Client SDK for Web and Mobile
 * Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8 Wire Contract
 */

export interface LocalMeConfig {
  projectSlug: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AuthOtpResponse {
  success: boolean;
  message: string;
  expiresInSeconds?: number;
  codeForTesting?: string;
  dispatchedVia?: string;
}

export interface IpgRequestOptions {
  amountIrr: number; // Stored in exact Iranian Rials (IRR)
  provider: 'ZARINPAL' | 'SEP' | 'BEHPARDAKHT' | 'SADAD';
  callbackDeepLink: string;
  customerPhone?: string;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface IpgResponse {
  success: boolean;
  authorityToken: string;
  redirectUrl: string;
  message?: string;
  trackingCode?: string;
  // Aliases for backward compatibility
  transactionId?: string;
  paymentUrl?: string;
}

export interface IpgVerifyOptions {
  authorityToken: string;
  trackingCode?: string;
  gateway?: string;
  status?: string;
}

export interface IpgVerifyResponse {
  success: boolean;
  amountIrr: number;
  referenceId: string;
  message: string;
  formattedToman: string;
  shaparakRefId?: string;
  newWalletBalanceIrr?: number;
}

export interface StorageFileMeta {
  bucket: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAtUtc: string;
  downloadUrl: string;
}

export interface FunctionInvokeResult<T = unknown> {
  success: boolean;
  output: T;
  executionTimeMs: number;
  logs?: string[];
  error?: string;
}

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
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
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
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
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
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
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
   * Relational Database Query Builder (PostgREST style).
   */
  public from<T = Record<string, unknown>>(table: string) {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const apiKey = this.apiKey;

    return {
      async select(): Promise<T[]> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
        });
        if (!res.ok) throw new Error(`Query failed: ${res.status}`);
        return (await res.json()) as T[];
      },

      async insert(record: Partial<T>): Promise<T> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/rest/${table}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(record),
        });
        if (!res.ok) throw new Error(`Insert failed: ${res.status}`);
        return (await res.json()) as T;
      },
    };
  }

  /**
   * Blob Storage Bucket API.
   */
  public get storage() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const apiKey = this.apiKey;

    return {
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

          getPublicUrl(fileName: string): string {
            return `${baseUrl}/_baas/v1/${projectSlug}/storage/${bucket}/${fileName}`;
          },
        };
      },
    };
  }

  /**
   * Edge Functions Invoker.
   */
  public get functions() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const apiKey = this.apiKey;

    return {
      async invoke<T = unknown>(slug: string, payload?: unknown): Promise<FunctionInvokeResult<T>> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/functions/${slug}/invoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
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

      async verifyOtp(phone: string, code: string): Promise<Record<string, unknown>> {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code }),
        });
        if (!res.ok) throw new Error(`Verify OTP failed: ${res.status}`);
        return (await res.json()) as Record<string, unknown>;
      },
    };
  }

  /**
   * Mobile Push Notifications & Device Registry.
   */
  public get push() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;
    const apiKey = this.apiKey;

    return {
      async registerDevice(options: {
        deviceId: string;
        pushToken: string;
        platform: 'ios' | 'android' | 'web';
        provider?: 'fcm' | 'apns' | 'najva' | 'pushy' | 'charkhooneh';
        userId?: string;
        tags?: string[];
      }) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/devices/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
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

      async send(options: {
        title: string;
        body: string;
        data?: Record<string, string>;
        targetUserIds?: string[];
        targetDeviceIds?: string[];
        targetPlatforms?: string[];
      }) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Push send failed: ${res.status}`);
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
    const apiKey = this.apiKey;

    return {
      async verifyBazaar(options: {
        packageName: string;
        productId: string;
        purchaseToken: string;
        userId?: string;
        priceIrr?: number;
      }) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/iap/verify/bazaar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Bazaar IAP verification failed: ${res.status}`);
        return await res.json();
      },

      async verifyMyket(options: {
        packageName: string;
        productId: string;
        purchaseToken: string;
        userId?: string;
        priceIrr?: number;
      }) {
        const res = await fetch(`${baseUrl}/_baas/v1/${projectSlug}/iap/verify/myket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(options),
        });
        if (!res.ok) throw new Error(`Myket IAP verification failed: ${res.status}`);
        return await res.json();
      },

      async getPurchases(userId?: string) {
        const url = new URL(`${baseUrl}/_baas/v1/${projectSlug}/iap/purchases`);
        if (userId) url.searchParams.set('userId', userId);
        const res = await fetch(url.toString(), {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (!res.ok) throw new Error(`Get IAP purchases failed: ${res.status}`);
        return await res.json();
      },
    };
  }

  /**
   * Duplex Realtime Streaming Client (WebSocket).
   */
  public get realtime() {
    const baseUrl = this.baseUrl;
    const projectSlug = this.projectSlug;

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
    };
  }

  /**
   * Inspect platform connectivity and regulatory flags.
   */
  public async getHealth(): Promise<{ status: string; role: string; timestamp: string }> {
    const res = await fetch(`${this.baseUrl}/healthz`);
    return (await res.json()) as { status: string; role: string; timestamp: string };
  }
}
